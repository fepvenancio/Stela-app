import Link from 'next/link'
import { findTokenByAddress, STATUS_LABELS } from '@stela/core'
import { formatAddress } from '@/lib/address'
import { formatTokenValue, formatDuration } from '@/lib/format'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import type { AssetRow } from '@/hooks/useInscriptions'

interface InscriptionCardProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  assets: AssetRow[]
}

/** Render assets of a given role as token chips with avatars */
function AssetSummary({ assets, role }: { assets: AssetRow[]; role: string }) {
  const roleAssets = assets.filter((a) => a.asset_role === role)
  if (roleAssets.length === 0) return <span className="text-ash">--</span>

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-end">
      {roleAssets.map((a) => {
        const token = findTokenByAddress(a.asset_address)
        const symbol = token?.symbol ?? formatAddress(a.asset_address)
        const decimals = token?.decimals ?? 18
        const isNFT = a.asset_type === 'ERC721'
        const display = isNFT
          ? `${symbol}${a.token_id && a.token_id !== '0' ? ` #${a.token_id}` : ''}`
          : `${formatTokenValue(a.value, decimals)} ${symbol}`

        return (
          <span
            key={`${a.asset_role}-${a.asset_index}`}
            className="inline-flex items-center gap-1 text-chalk font-medium"
          >
            <TokenAvatarByAddress address={a.asset_address} size={14} />
            {display}
          </span>
        )
      })}
    </div>
  )
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
  const statusKey = (status in STATUS_LABELS ? status : 'open') as BadgeVariant
  const label = STATUS_LABELS[statusKey]
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
            <Badge variant={statusKey}>{label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-2.5 pt-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-dust shrink-0">Debt</span>
            {hasAssets ? (
              <AssetSummary assets={assets} role="debt" />
            ) : (
              <span className="text-ash">--</span>
            )}
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-dust shrink-0">Collateral</span>
            {hasAssets ? (
              <AssetSummary assets={assets} role="collateral" />
            ) : (
              <span className="text-ash">--</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-dust">Duration</span>
            <span className="text-chalk font-medium">{formatDuration(Number(duration))}</span>
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
