import { formatTokenValue } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import type { PortfolioSummary, TokenAmount } from '@/hooks/usePortfolio'

interface SummaryBarProps {
  summary: PortfolioSummary
}

function TokenList({ amounts }: { amounts: TokenAmount[] }) {
  if (amounts.length === 0) return <span className="text-chalk font-display text-lg">0</span>

  return (
    <div className="flex flex-col gap-1.5">
      {amounts.map((t) => (
        <span key={t.address} className="inline-flex items-center gap-1.5 text-chalk font-display text-lg">
          <TokenAvatarByAddress address={t.address} size={16} />
          {formatTokenValue(t.total.toString(), t.decimals)} {t.symbol}
        </span>
      ))}
    </div>
  )
}

function MetricCard({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-edge/30 bg-surface/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">{label}</span>
      </div>
      {children}
    </div>
  )
}

export function SummaryBar({ summary }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      <MetricCard label="Total Lent" color="bg-star">
        <TokenList amounts={summary.totalLent} />
      </MetricCard>

      <MetricCard label="Collateral Locked" color="bg-nebula">
        <TokenList amounts={summary.collateralLocked} />
      </MetricCard>

      <MetricCard label="Redeemable" color="bg-cosmic">
        <span className="text-chalk font-display text-lg">{summary.redeemableCount}</span>
      </MetricCard>

      <MetricCard label="Off-chain Orders" color="bg-aurora">
        <span className="text-chalk font-display text-lg">{summary.orderCount}</span>
      </MetricCard>
    </div>
  )
}
