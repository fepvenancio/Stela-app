import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { PortfolioSummary, TokenAmount } from '@/components/portfolio/SummaryBar'
import type { PortfolioData, EnrichedInscription } from '@/hooks/usePortfolio'

type PortfolioSummaryInput = Pick<
  PortfolioData,
  'lending' | 'borrowing' | 'redeemable' | 'borrowingOrders' | 'lendingOrders'
>

const ACTIVE_STATUSES = new Set(['filled', 'grace_period'])

function aggregateAssets(
  inscriptions: EnrichedInscription[],
  role: string,
  statusFilter?: Set<string>,
): TokenAmount[] {
  const map = new Map<string, bigint>()

  for (const ins of inscriptions) {
    if (statusFilter && !statusFilter.has(ins.computedStatus)) continue
    for (const asset of (ins.assets ?? []).filter((a) => a.asset_role === role)) {
      const current = map.get(asset.asset_address) ?? 0n
      map.set(asset.asset_address, current + BigInt(asset.value ?? '0'))
    }
  }

  return [...map.entries()].map(([address, total]) => {
    const token = findTokenByAddress(address)
    return {
      address,
      symbol: token?.symbol ?? address.slice(0, 8),
      decimals: token?.decimals ?? 18,
      total,
    }
  })
}

export function computePortfolioSummary(data: PortfolioSummaryInput): PortfolioSummary {
  return {
    totalLent: aggregateAssets(data.lending, 'debt', ACTIVE_STATUSES),
    totalBorrowed: aggregateAssets(data.borrowing, 'debt', ACTIVE_STATUSES),
    redeemableCount: data.redeemable.length,
    orderCount: data.borrowingOrders.length + data.lendingOrders.length,
  }
}
