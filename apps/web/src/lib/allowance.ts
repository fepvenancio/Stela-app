/**
 * @title ERC20 Allowance Pre-Check
 * @notice Skips redundant approve calls when allowance is already sufficient
 * @dev Since we approve U128_MAX, after the first approval the remaining
 *      allowance is still enormous. Re-approving wastes gas.
 */
import { RpcProvider } from 'starknet'
import { toU256 } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS } from '@/lib/config'

const U128_MAX = (1n << 128n) - 1n

/**
 * Threshold below which we re-approve. Set to 2^120 — still astronomical,
 * but if allowance somehow dropped below this we should re-approve.
 */
const REAPPROVE_THRESHOLD = 1n << 120n

export interface ApproveCall {
  contractAddress: string
  entrypoint: string
  calldata: string[]
}

/**
 * Build approve calls only for tokens whose current allowance is below threshold.
 * @param provider  - RPC provider for reading allowance
 * @param owner     - The address whose allowance to check (the user)
 * @param tokenAddresses - Unique ERC20/ERC4626 token addresses to check
 * @param spender   - The spender contract (defaults to CONTRACT_ADDRESS)
 * @returns Array of approve calls (only for tokens needing approval)
 */
export async function buildApprovalsIfNeeded(
  provider: RpcProvider,
  owner: string,
  tokenAddresses: string[],
  spender: string = CONTRACT_ADDRESS,
): Promise<ApproveCall[]> {
  const calls: ApproveCall[] = []

  // Check all allowances in parallel for speed
  const checks = await Promise.allSettled(
    tokenAddresses.map(async (tokenAddr) => {
      const allowance = await readAllowance(provider, tokenAddr, owner, spender)
      return { tokenAddr, allowance }
    }),
  )

  for (const result of checks) {
    if (result.status === 'fulfilled') {
      const { tokenAddr, allowance } = result.value
      if (allowance < REAPPROVE_THRESHOLD) {
        calls.push({
          contractAddress: tokenAddr,
          entrypoint: 'approve',
          calldata: [spender, ...toU256(U128_MAX)],
        })
      }
    } else {
      // RPC read failed — approve to be safe (fail open for approvals)
      const tokenAddr = tokenAddresses[checks.indexOf(result)]
      calls.push({
        contractAddress: tokenAddr,
        entrypoint: 'approve',
        calldata: [spender, ...toU256(U128_MAX)],
      })
    }
  }

  return calls
}

/**
 * Read ERC20 allowance(owner, spender) from chain.
 * Returns the allowance as a bigint (u256 = low + high << 128).
 */
async function readAllowance(
  provider: RpcProvider,
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'allowance',
    calldata: [owner, spender],
  })
  // u256 = low (felt) + high (felt) << 128
  return BigInt(result[0]) + (BigInt(result[1] ?? '0') << 128n)
}

/**
 * Check if an ERC721/ERC1155 is already approved for all.
 * Returns true if set_approval_for_all is already granted.
 */
export async function isApprovedForAll(
  provider: RpcProvider,
  tokenAddress: string,
  owner: string,
  operator: string = CONTRACT_ADDRESS,
): Promise<boolean> {
  try {
    const result = await provider.callContract({
      contractAddress: tokenAddress,
      entrypoint: 'is_approved_for_all',
      calldata: [owner, operator],
    })
    return result[0] === '0x1' || result[0] === '1'
  } catch {
    return false // Fail safe — will approve
  }
}
