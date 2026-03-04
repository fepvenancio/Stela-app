import type { RpcProvider } from 'starknet'
import type { Asset } from '@fepvenancio/stela-sdk'
import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'

export interface BalanceShortfall {
  asset: Asset
  symbol: string
  needed: bigint
  balance: bigint
  neededFormatted: string
  balanceFormatted: string
}

/** Read the ERC-20 balanceOf for `owner` directly from the contract. */
export async function getErc20Balance(
  provider: RpcProvider,
  tokenAddress: string,
  owner: string,
): Promise<bigint> {
  const result = await provider.callContract(
    { contractAddress: tokenAddress, entrypoint: 'balance_of', calldata: [owner] },
    'latest',
  )
  // balanceOf returns u256 (low, high)
  return BigInt(result[0]) + (BigInt(result[1] ?? '0') << 128n)
}

/**
 * Check that `owner` holds enough of each ERC-20 debt asset to cover the
 * proportional amount at the given BPS.  Returns the first shortfall found,
 * or `null` if all balances are sufficient.
 */
export async function findDebtBalanceShortfall(
  provider: RpcProvider,
  owner: string,
  debtAssets: Asset[],
  bps: number,
): Promise<BalanceShortfall | null> {
  const erc20Assets = debtAssets.filter(
    (a) => a.asset_type === 'ERC20' || a.asset_type === 'ERC4626',
  )

  for (const asset of erc20Assets) {
    const needed = (asset.value * BigInt(bps)) / 10000n
    if (needed === 0n) continue

    const balance = await getErc20Balance(provider, asset.asset_address, owner)
    if (balance < needed) {
      const token = findTokenByAddress(asset.asset_address)
      const symbol = token?.symbol ?? asset.asset_address.slice(0, 10) + '...'
      const decimals = token?.decimals ?? 18
      return {
        asset,
        symbol,
        needed,
        balance,
        neededFormatted: formatTokenValue(needed.toString(), decimals),
        balanceFormatted: formatTokenValue(balance.toString(), decimals),
      }
    }
  }

  return null
}
