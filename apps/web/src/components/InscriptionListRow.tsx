'use client'

import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress } from '@/lib/address'
import { formatTokenValue, formatDuration } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS } from '@fepvenancio/stela-sdk'
import type { AssetRow } from '@/types/api'
import Link from 'next/link'

interface InscriptionListRowProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  assets: AssetRow[]
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
}

function CompactAssetSummary({ assets, role }: { assets: AssetRow[]; role: string }) {
  const roleAssets = assets.filter((a) => a.asset_role === role)
  if (roleAssets.length === 0) return <span className="text-ash/50 text-[10px]">None</span>

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {roleAssets.map((a, i) => {
        const token = findTokenByAddress(a.asset_address)
        const symbol = token?.symbol ?? formatAddress(a.asset_address)
        const decimals = token?.decimals ?? 18
        const isNFT = a.asset_type === 'ERC721'
        const display = isNFT
          ? `${symbol}${a.token_id && a.token_id !== '0' ? ` #${a.token_id}` : ''}`
          : `${formatTokenValue(a.value, decimals)} ${symbol}`

        return (
          <div key={i} className="flex items-center gap-1.5">
            <TokenAvatarByAddress address={a.asset_address} size={14} />
            <span className="text-xs font-medium text-chalk">{display}</span>
          </div>
        )
      })}
    </div>
  )
}

export function InscriptionListRow({
  id,
  status,
  creator,
  multiLender,
  duration,
  assets,
  selectable,
  selected,
  onSelect,
}: InscriptionListRowProps) {
  type BadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'cancelled'
  const statusKey = (status in STATUS_LABELS ? status : 'open') as BadgeVariant
  const label = STATUS_LABELS[statusKey]

  const row = (
    <div
      onClick={selectable ? () => onSelect?.() : undefined}
      className={`group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 ${
        selectable ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'bg-star/5 border-star/30'
          : 'bg-surface/20 border-edge/50 hover:border-edge hover:bg-surface/40'
      }`}
    >
      {/* Checkbox column — always rendered for alignment */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {selectable ? (
          <div
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select inscription ${id.slice(2, 8)}`}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect?.(); } }}
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
              selected ? 'bg-star border-star' : 'border-dust/40 bg-surface/60 hover:border-star/50'
            }`}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-void" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ) : (
          <div className="w-5 h-5" />
        )}
      </div>

      {/* Desktop: 12-column grid */}
      <div className="hidden md:grid grid-cols-12 gap-4 flex-1 items-center">
        {/* Status & ID */}
        <div className="col-span-2 flex flex-col gap-1">
          <Badge variant={statusKey} className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
            {label}
          </Badge>
          <Link
            href={`/inscription/${id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10px] text-ash tracking-wider uppercase hover:text-star transition-colors"
          >
            #{id.slice(2, 8)}
          </Link>
        </div>

        {/* Debt */}
        <div className="col-span-3 flex flex-col gap-0.5">
          <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
          <CompactAssetSummary assets={assets} role="debt" />
        </div>

        {/* Interest */}
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Interest</span>
          <CompactAssetSummary assets={assets} role="interest" />
        </div>

        {/* Collateral */}
        <div className="col-span-3 flex flex-col gap-0.5">
          <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
          <CompactAssetSummary assets={assets} role="collateral" />
        </div>

        {/* Duration */}
        <div className="col-span-2 flex flex-col items-end gap-0.5">
          <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Duration</span>
          <span className="text-chalk text-xs font-medium">{formatDuration(Number(duration))}</span>
        </div>
      </div>

      {/* Mobile: card-style stacked layout */}
      <div className="flex md:hidden flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={statusKey} className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
              {label}
            </Badge>
            <Link
              href={`/inscription/${id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[10px] text-ash tracking-wider uppercase hover:text-star transition-colors"
            >
              #{id.slice(2, 8)}
            </Link>
          </div>
          <span className="text-chalk text-xs font-medium shrink-0">{formatDuration(Number(duration))}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
            <CompactAssetSummary assets={assets} role="debt" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
            <CompactAssetSummary assets={assets} role="collateral" />
          </div>
        </div>
      </div>
    </div>
  )

  if (selectable) return row

  return (
    <Link href={`/inscription/${id}`} className="block" aria-label={`View inscription ${id.slice(2, 8)}`}>
      {row}
    </Link>
  )
}
