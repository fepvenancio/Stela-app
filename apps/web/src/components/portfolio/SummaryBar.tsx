'use client'

import { Card } from '@/components/ui/card'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { formatTokenValue } from '@/lib/format'
import type { PortfolioSummary, TokenAmount } from '@/hooks/usePortfolio'

function TokenBreakdown({ amounts }: { amounts: TokenAmount[] }) {
  if (amounts.length === 0) {
    return <span className="text-ash text-sm">--</span>
  }
  return (
    <div className="flex flex-col gap-1">
      {amounts.map((t) => (
        <span key={t.address} className="inline-flex items-center gap-1.5 text-chalk text-sm font-medium">
          <TokenAvatarByAddress address={t.address} size={14} />
          {formatTokenValue(t.total.toString(), t.decimals)} {t.symbol}
        </span>
      ))}
    </div>
  )
}

interface SummaryBarProps {
  summary: PortfolioSummary
}

export function SummaryBar({ summary }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {/* Total Lent */}
      <Card className="p-4 bg-surface/20 border-edge/20">
        <span className="text-[10px] text-ash uppercase tracking-widest font-bold block mb-2">
          Total Lent
        </span>
        <div className="text-star">
          <TokenBreakdown amounts={summary.totalLent} />
        </div>
      </Card>

      {/* Collateral Locked */}
      <Card className="p-4 bg-surface/20 border-edge/20">
        <span className="text-[10px] text-ash uppercase tracking-widest font-bold block mb-2">
          Collateral Locked
        </span>
        <div className="text-nebula">
          <TokenBreakdown amounts={summary.collateralLocked} />
        </div>
      </Card>

      {/* Redeemable */}
      <Card className="p-4 bg-surface/20 border-edge/20">
        <span className="text-[10px] text-ash uppercase tracking-widest font-bold block mb-2">
          Redeemable
        </span>
        <span className="text-cosmic font-display text-2xl">
          {summary.redeemableCount}
        </span>
      </Card>

      {/* Active */}
      <Card className="p-4 bg-surface/20 border-edge/20">
        <span className="text-[10px] text-ash uppercase tracking-widest font-bold block mb-2">
          Active
        </span>
        <span className="text-aurora font-display text-2xl">
          {summary.activeCount}
        </span>
      </Card>
    </div>
  )
}
