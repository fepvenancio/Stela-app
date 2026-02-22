'use client'

import Link from 'next/link'
import { findTokenByAddress, STATUS_LABELS } from '@stela/core'
import type { InscriptionStatus } from '@stela/core'
import { formatTokenValue, formatDuration } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import type { AssetRow } from '@/types/api'
import type { EnrichedInscription } from '@/hooks/usePortfolio'

type BadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'cancelled'

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

function TimeRemaining({ inscription }: { inscription: EnrichedInscription }) {
  const signedAt = BigInt(inscription.signed_at ?? '0')
  const duration = BigInt(inscription.duration)

  if (signedAt === 0n) {
    return <span className="text-dust text-sm">{formatDuration(duration)} term</span>
  }

  const deadline = signedAt + duration
  const now = BigInt(Math.floor(Date.now() / 1000))

  if (now >= deadline) {
    return <span className="text-nova text-sm font-medium">Expired</span>
  }

  const remaining = deadline - now
  return <span className="text-chalk text-sm">{formatDuration(remaining)} left</span>
}

// -----------------------------------------------------------------------
// Role-specific content
// -----------------------------------------------------------------------

function LenderContent({ inscription }: { inscription: EnrichedInscription }) {
  const assets = inscription.assets ?? []
  return (
    <div className="space-y-3">
      <div>
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold block mb-1">Debt</span>
        <AssetList assets={assets} role="debt" />
      </div>
      <div>
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold block mb-1">Interest</span>
        <AssetList assets={assets} role="interest" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Duration</span>
        <TimeRemaining inscription={inscription} />
      </div>
    </div>
  )
}

function BorrowerContent({ inscription }: { inscription: EnrichedInscription }) {
  const assets = inscription.assets ?? []
  return (
    <div className="space-y-3">
      <div>
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold block mb-1">Collateral</span>
        <AssetList assets={assets} role="collateral" />
      </div>
      <div>
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold block mb-1">Debt Owed</span>
        <AssetList assets={assets} role="debt" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Time</span>
        <TimeRemaining inscription={inscription} />
      </div>
    </div>
  )
}

function RedeemableContent({ inscription, shareBalance }: { inscription: EnrichedInscription; shareBalance: string }) {
  return (
    <div className="space-y-3">
      <div>
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold block mb-1">Collateral</span>
        <AssetList assets={inscription.assets ?? []} role="collateral" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-dust uppercase tracking-widest font-semibold">Shares</span>
        <span className="text-chalk text-sm font-medium">{BigInt(shareBalance).toLocaleString()}</span>
      </div>
      <div className="pt-1">
        <span className="text-cosmic text-xs font-display uppercase tracking-wider">Claim Available</span>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------

export type PositionRole = 'lender' | 'borrower' | 'redeemable'

interface PositionCardProps {
  inscription: EnrichedInscription
  role: PositionRole
  shareBalance?: string
}

const ROLE_ACCENTS: Record<PositionRole, string> = {
  lender: 'group-hover:border-star/40',
  borrower: 'group-hover:border-nebula/40',
  redeemable: 'group-hover:border-cosmic/40',
}

export function PositionCard({ inscription, role, shareBalance }: PositionCardProps) {
  const statusKey = (inscription.computedStatus in STATUS_LABELS
    ? inscription.computedStatus
    : 'open') as BadgeVariant
  const label = STATUS_LABELS[statusKey as InscriptionStatus]

  return (
    <Link
      href={`/inscription/${inscription.id}`}
      className="group block transition-all duration-300 hover:-translate-y-1"
    >
      <Card className={`relative overflow-hidden p-5 border-edge bg-surface/40 backdrop-blur-sm transition-all duration-300 granite-noise ${ROLE_ACCENTS[role]}`}>
        {/* Header: ID + Status */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-edge/10">
          <span className="font-mono text-[10px] text-ash tracking-[0.2em] uppercase">
            #{inscription.id.slice(2, 8)}
          </span>
          <Badge variant={statusKey} className="rounded-full px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">
            {label}
          </Badge>
        </div>

        {/* Role-specific content */}
        {role === 'lender' && <LenderContent inscription={inscription} />}
        {role === 'borrower' && <BorrowerContent inscription={inscription} />}
        {role === 'redeemable' && (
          <RedeemableContent inscription={inscription} shareBalance={shareBalance ?? '0'} />
        )}
      </Card>
    </Link>
  )
}
