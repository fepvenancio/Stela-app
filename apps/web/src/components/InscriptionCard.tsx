import Link from 'next/link'
import { findTokenByAddress } from '@stela/core'
import { formatAddress } from '@/lib/address'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AssetRow } from '@/hooks/useInscriptions'

interface InscriptionCardProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  assets: AssetRow[]
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  partial: 'Partial',
  filled: 'Filled',
  repaid: 'Repaid',
  liquidated: 'Liquidated',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

function formatDuration(seconds: string): string {
  const h = Math.floor(Number(seconds) / 3600)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h`
}

/** Format a raw token value given its decimals */
function formatValue(raw: string | null, decimals: number): string {
  if (!raw || raw === '0') return '0'
  const n = BigInt(raw)
  if (decimals === 0) return n.toString()
  const divisor = 10n ** BigInt(decimals)
  const whole = n / divisor
  const frac = n % divisor
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole}.${fracStr}`
}

/** Summarize assets of a given role into a compact display string */
function summarizeAssets(assets: AssetRow[], role: string): string {
  const roleAssets = assets.filter((a) => a.asset_role === role)
  if (roleAssets.length === 0) return '--'

  return roleAssets
    .map((a) => {
      const token = findTokenByAddress(a.asset_address)
      const symbol = token?.symbol ?? formatAddress(a.asset_address)
      const decimals = token?.decimals ?? 18
      if (a.asset_type === 'ERC721') {
        const tid = a.token_id && a.token_id !== '0' ? `#${a.token_id}` : ''
        return `${symbol}${tid}`
      }
      return `${formatValue(a.value, decimals)} ${symbol}`
    })
    .join(', ')
}

type BadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'cancelled'

export function InscriptionCard({
  id,
  status,
  creator,
  multiLender,
  duration,
  assets,
}: InscriptionCardProps) {
  const label = STATUS_LABELS[status] ?? 'Open'
  const variant = (status in STATUS_LABELS ? status : 'open') as BadgeVariant
  const hasAssets = assets.length > 0

  return (
    <Link
      href={`/inscription/${id}`}
      className="group block hover:shadow-[0_0_40px_-12px_rgba(232,168,37,0.07)] transition-all duration-300"
    >
      <Card className="p-5 hover:border-edge-bright hover:bg-elevated/40 transition-all duration-300">
        <CardHeader className="p-0 pb-0 gap-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-ash tracking-wide">
              {formatAddress(id)}
            </span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-2.5 pt-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-dust shrink-0">Debt</span>
            <span className="text-chalk font-medium truncate text-right">
              {hasAssets ? summarizeAssets(assets, 'debt') : '--'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-dust shrink-0">Collateral</span>
            <span className="text-chalk truncate text-right">
              {hasAssets ? summarizeAssets(assets, 'collateral') : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dust">Duration</span>
            <span className="text-chalk font-medium">{formatDuration(duration)}</span>
          </div>
        </CardContent>

        <CardFooter className="p-0 pt-4 border-t border-edge flex items-center justify-between">
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
        </CardFooter>
      </Card>
    </Link>
  )
}
