/**
 * Server-side on-chain nonce verification via raw JSON-RPC.
 *
 * Calls the Stela contract's `nonces(owner)` function to get the current
 * nonce for an address, and compares it with the expected value.
 *
 * Works in Cloudflare Worker environment — uses only fetch(), no starknet.js.
 */

import { RPC_URL, CONTRACT_ADDRESS } from '@/lib/config'

/**
 * The `nonces` entry_point_selector.
 * Computed as: starknet_keccak('nonces') & ((1 << 250) - 1)
 */
const NONCES_SELECTOR =
  '0x54ed3b44e062c2512c7d33eb0c6bb551261bef4f17ca9367201ef0f7aa001'

function toHexFelt(value: string | bigint | number): string {
  if (typeof value === 'bigint' || typeof value === 'number') {
    return '0x' + BigInt(value).toString(16)
  }
  const s = String(value).trim()
  if (s.startsWith('0x') || s.startsWith('0X')) return s
  try {
    return '0x' + BigInt(s).toString(16)
  } catch {
    return s
  }
}

export interface NonceResult {
  valid: boolean
  onChain?: bigint
  submitted?: bigint
}

/**
 * Verify that the provided nonce matches the current on-chain nonce for the given address.
 *
 * @param address - The StarkNet account address
 * @param expectedNonce - The nonce value to check against the contract
 * @returns { valid, onChain, submitted } for detailed error messages
 */
export async function verifyNonce(
  address: string,
  expectedNonce: bigint,
): Promise<NonceResult> {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'starknet_call',
    params: {
      request: {
        contract_address: CONTRACT_ADDRESS,
        entry_point_selector: NONCES_SELECTOR,
        calldata: [toHexFelt(address)],
      },
      block_id: 'latest',
    },
  }

  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`RPC HTTP error during nonce verification: ${response.status}`)
      return { valid: true } // Fail open
    }

    const result = await response.json() as {
      result?: string[]
      error?: { code: number; message: string }
    }

    if (result.error) {
      console.error('RPC error during nonce verification:', JSON.stringify(result.error))
      return { valid: true } // Fail open
    }

    if (!result.result || result.result.length === 0) {
      console.error('RPC returned empty result for nonces()')
      return { valid: true } // Fail open
    }

    const onChainNonce = BigInt(result.result[0])
    if (onChainNonce !== expectedNonce) {
      console.error(
        `Nonce mismatch for ${address}: on-chain=${onChainNonce}, submitted=${expectedNonce}`,
      )
      return { valid: false, onChain: onChainNonce, submitted: expectedNonce }
    }

    return { valid: true, onChain: onChainNonce, submitted: expectedNonce }
  } catch (err) {
    console.error(
      'Nonce verification RPC call failed:',
      err instanceof Error ? err.message : String(err),
    )
    return { valid: true } // Fail open
  }
}
