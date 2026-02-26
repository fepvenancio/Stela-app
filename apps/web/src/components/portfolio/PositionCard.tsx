import Link from 'next/link'
import { findTokenByAddress, STATUS_LABELS } from '@stela/core'
import { formatTokenValue, formatDuration } from '@/lib/format'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { AssetRow } from '@/types/api'

type BadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'cancelled'

export type PositionRole = 'lender' | 'borrower' | 'redeemable'

interface PositionCardProps {
  inscription: EnrichedInscription
  role: PositionRole
  shareBalance?: string
}

const ROLE_COLORS: Record<PositionRole, string> = {
  lender: 'star',
  borrower: 'nebula',
  redeemable: 'cosmic',
}

const ROLE_LABELS: Record<PositionRole, string> = {
  lender: 'Lender',
  borrower: 'Borrower',
  redeemable: 'Redeemable',
}

const ROLE_HOVER: Record<PositionRole, string> = {
  lender: 'group-hover:border-star/40',
  borrower: 'group-hover:border-nebula/40',
  redeemable: 'group-hover:border-cosmic/40',
}

const ROLE_TEXT: Record<PositionRole, string> = {
  lender: 'text-star',
  borrower: 'text-nebula',
  redeemable: 'text-cosmic',
}

function AssetList({ assets, role }: { assets: AssetRow[]; role: string }) {
  const filtered = assets.filter((a) => a.asset_role === role)
  if (filtered.length === 0) return <span className="text-ash italic text-xs">none</span>

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filtered.map((a) => {
        const token = findTokenByAddress(a.asset_address)
        const symbol = token?.symbol ?? a.asset_address.slice(0, 8)
        const decimals = token?.decimals ?? 18
        const isNFT = a.asset_type === 'ERC721'
        const display = isNFT
          ? `${symbol}${a.token_id && a.token_id !== '0' ? ` #${a.token_id}` : ''}`
          : `${formatTokenValue(a.value, decimals)} ${symbol}`

        return (
          <span key={`${a.asset_role}-${a.asset_index}`} className="inline-flex items-center gap-1 text-chalk text-sm font-medium">
            <TokenAvatarByAddress address={a.asset_address} size={14} />
            {display}
          </span>
        )
      })}
    </div>
  )
}

function LenderContent({ inscription }: { inscription: EnrichedInscription }) {
  const assets = inscription.assets ?? []
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Debt</span>
        <AssetList assets={assets} role="debt" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Interest</span>
        <AssetList assets={assets} role="interest" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Duration</span>
        <span className="text-chalk font-display text-base">
          {formatDuration(Number(inscription.duration))}
        </span>
      </div>
    </>
  )
}

function BorrowerContent({ inscription }: { inscription: EnrichedInscription }) {
  const assets = inscription.assets ?? []
  const signedAt = Number(inscription.signed_at ?? '0')
  const duration = Number(inscription.duration)

  let timeDisplay: string | null = null
  if (signedAt > 0 && duration > 0) {
    const deadline = signedAt + duration
    const now = Math.floor(Date.now() / 1000)
    const remaining = deadline - now
    timeDisplay = remaining > 0 ? formatDuration(remaining) : 'Expired'
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
        <AssetList assets={assets} role="collateral" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Debt Owed</span>
        <AssetList assets={assets} role="debt" />
      </div>
      {timeDisplay && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Time Remaining</span>
          <span className={`font-display text-base ${timeDisplay === 'Expired' ? 'text-nova' : 'text-chalk'}`}>
            {timeDisplay}
          </span>
        </div>
      )}
    </>
  )
}

function RedeemableContent({
  inscription,
  shareBalance,
}: {
  inscription: EnrichedInscription
  shareBalance: string
}) {
  const statusKey = (inscription.computedStatus in STATUS_LABELS
    ? inscription.computedStatus
    : 'open') as BadgeVariant

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Status</span>
        <Badge variant={statusKey} className="rounded-full px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider w-fit">
          {STATUS_LABELS[statusKey]}
        </Badge>
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Share Balance</span>
        <span className="text-chalk font-display text-base">{shareBalance}</span>
      </div>
      <div className="pt-2">
        <span className="text-cosmic text-xs font-display uppercase tracking-wider">
          Claim Available
        </span>
      </div>
    </>
  )
}

export function PositionCard({ inscription, role, shareBalance }: PositionCardProps) {
  const statusKey = (inscription.computedStatus in STATUS_LABELS
    ? inscription.computedStatus
    : 'open') as BadgeVariant

  return (
    <Link
      href={`/inscription/${inscription.id}`}
      className="group block transition-all duration-300 hover:-translate-y-1"
    >
      <Card className={`granite-noise rounded-3xl border-edge bg-surface/40 backdrop-blur-sm p-6 transition-all duration-300 ${ROLE_HOVER[role]}`}>
        <CardHeader className="p-0 pb-4 gap-0 border-b border-edge/10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-ash tracking-[0.2em] uppercase">
              #{inscription.id.slice(2, 8)}
            </span>
            <Badge variant={statusKey} className="rounded-full px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">
              {STATUS_LABELS[statusKey]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-4 pt-5 text-sm">
          {role === 'lender' && <LenderContent inscription={inscription} />}
          {role === 'borrower' && <BorrowerContent inscription={inscription} />}
          {role === 'redeemable' && (
            <RedeemableContent inscription={inscription} shareBalance={shareBalance ?? '0'} />
          )}
        </CardContent>

        <CardFooter className="p-0 pt-5 border-t border-edge/10">
          <span className={`text-[10px] ${ROLE_TEXT[role]} font-display uppercase tracking-wider`}>
            {ROLE_LABELS[role]}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
