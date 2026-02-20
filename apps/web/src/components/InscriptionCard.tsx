import Link from 'next/link'
import { formatAddress } from '@/lib/address'

interface InscriptionCardProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  debtAssetCount: number
  collateralAssetCount: number
}

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  open:       { color: 'text-aurora', dot: 'bg-aurora', label: 'Open' },
  partial:    { color: 'text-ember',  dot: 'bg-ember',  label: 'Partial' },
  filled:     { color: 'text-nebula', dot: 'bg-nebula', label: 'Filled' },
  repaid:     { color: 'text-dust',   dot: 'bg-dust',   label: 'Repaid' },
  liquidated: { color: 'text-nova',   dot: 'bg-nova',   label: 'Liquidated' },
  expired:    { color: 'text-ember',  dot: 'bg-ember',  label: 'Expired' },
  cancelled:  { color: 'text-ash',    dot: 'bg-ash',    label: 'Cancelled' },
}

function formatDuration(seconds: string): string {
  const h = Math.floor(Number(seconds) / 3600)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h`
}

export function InscriptionCard({
  id,
  status,
  creator,
  multiLender,
  duration,
  debtAssetCount,
  collateralAssetCount,
}: InscriptionCardProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open

  return (
    <Link
      href={`/inscription/${id}`}
      className="group block rounded-2xl border border-edge bg-surface/40 backdrop-blur-sm p-5 hover:border-edge-bright hover:bg-elevated/40 transition-all duration-300 hover:shadow-[0_0_40px_-12px_rgba(232,168,37,0.07)]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[11px] text-ash tracking-wide">
          {formatAddress(id)}
        </span>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-dust">Duration</span>
          <span className="text-chalk font-medium">{formatDuration(duration)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dust">Debt assets</span>
          <span className="text-chalk">{debtAssetCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dust">Collateral</span>
          <span className="text-chalk">{collateralAssetCount}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-edge flex items-center justify-between">
        <span className="text-[11px] text-ash font-mono">
          {formatAddress(creator)}
        </span>
        {multiLender && (
          <span className="flex items-center gap-1 text-[11px] text-star">
            <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current" aria-hidden="true">
              <path d="M5 0l1.18 3.82L10 5l-3.82 1.18L5 10l-1.18-3.82L0 5l3.82-1.18z" />
            </svg>
            Multi-lender
          </span>
        )}
      </div>
    </Link>
  )
}
