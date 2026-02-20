import { formatAddress } from '@/lib/address'

interface AgreementCardProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  debtAssetCount: number
  collateralAssetCount: number
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-900 text-green-300',
  partial: 'bg-yellow-900 text-yellow-300',
  filled: 'bg-blue-900 text-blue-300',
  repaid: 'bg-neutral-800 text-neutral-400',
  liquidated: 'bg-red-900 text-red-300',
  expired: 'bg-orange-900 text-orange-300',
  cancelled: 'bg-neutral-800 text-neutral-500',
}

export function AgreementCard({
  id,
  status,
  creator,
  multiLender,
  duration,
  debtAssetCount,
  collateralAssetCount,
}: AgreementCardProps) {
  const durationHours = Math.floor(Number(duration) / 3600)

  return (
    <a
      href={`/agreement/${id}`}
      className="block p-4 rounded-lg border border-neutral-800 hover:border-neutral-600 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm text-neutral-400">{formatAddress(id)}</span>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[status] ?? 'bg-neutral-800'}`}>
          {status}
        </span>
      </div>
      <div className="text-sm space-y-1">
        <div>Creator: {formatAddress(creator)}</div>
        <div>Duration: {durationHours}h</div>
        <div>Debt assets: {debtAssetCount} | Collateral: {collateralAssetCount}</div>
        {multiLender && <div className="text-blue-400 text-xs">Multi-lender</div>}
      </div>
    </a>
  )
}
