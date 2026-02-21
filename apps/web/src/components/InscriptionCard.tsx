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
  if (roleAssets.length === 0) return <span className="text-ash italic">unspecified</span>

  return (
    <div className="flex flex-wrap items-center gap-2 justify-start">
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
      className="group block transition-all duration-300 hover:-translate-y-1"
    >
      <Card className="relative overflow-hidden p-6 border-edge/30 bg-surface/20 backdrop-blur-sm group-hover:border-star/30 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-star/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <CardHeader className="p-0 pb-4 gap-0 border-b border-edge/10 relative z-10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-ash tracking-[0.2em] uppercase">
              #{id.slice(2, 8)}
            </span>
            <Badge variant={statusKey} className="rounded-full px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">
              {label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-4 pt-5 text-sm relative z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Debt</span>
            <div className="flex justify-start">
              {hasAssets ? (
                <AssetSummary assets={assets} role="debt" />
              ) : (
                <span className="text-ash italic">unspecified</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
            <div className="flex justify-start">
              {hasAssets ? (
                <AssetSummary assets={assets} role="collateral" />
              ) : (
                <span className="text-ash italic">unspecified</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Duration</span>
            <span className="text-chalk font-display text-base">
              {formatDuration(Number(duration))}
            </span>
          </div>
        </CardContent>

        <CardFooter className="p-0 pt-5 border-t border-edge/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5 group/creator">
             <div className="w-4 h-4 rounded-full bg-void flex items-center justify-center text-[8px] text-star border border-star/20">
                S
             </div>
             <span className="text-[11px] text-ash font-mono group-hover/creator:text-dust transition-colors">
               {formatAddress(creator)}
             </span>
          </div>
          {multiLender && (
            <span className="flex items-center gap-1.5 text-[10px] text-star/80 font-display uppercase tracking-wider">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Shared
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  )
}
