'use client'

import { formatDuration } from '@/lib/format'
import { getStatusBadgeVariant, getStatusLabel, STATUS_DESCRIPTIONS } from '@/lib/status'
import { CompactAssetSummary } from '@/components/CompactAssetSummary'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { AssetRow } from '@/types/api'
import Link from 'next/link'

interface InscriptionListRowProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  assets: AssetRow[]
  /** Unredeemed share balance — shown as "Pending Redemption" indicator */
  pendingShares?: string
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
  /** Action button callback (Swap or Lend) */
  onAction?: () => void
  actionPending?: boolean
}

function AssetsByRole({ assets, role }: { assets: AssetRow[]; role: string }) {
  const filtered = assets.filter((a) => a.asset_role === role)
  return <CompactAssetSummary assets={filtered} />
}

export function InscriptionListRow({
  id,
  status,
  creator,
  multiLender,
  duration,
  assets,
  pendingShares,
  selectable,
  selected,
  onSelect,
  onAction,
  actionPending,
}: InscriptionListRowProps) {
  const statusKey = getStatusBadgeVariant(status)
  const label = getStatusLabel(status)
  const isSwap = Number(duration) === 0

  const row = (
    <div
      onClick={selectable ? () => onSelect?.() : undefined}
      className={`group flex items-center gap-3 px-3 py-3 border-b transition-colors duration-100 ${
        selectable ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'bg-star/5 border-star/20'
          : 'border-edge/20 hover:bg-surface/30'
      }`}
    >
      {/* Checkbox — only rendered when selectable */}
      {selectable && (
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          <div
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select inscription ${id.slice(2, 8)}`}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect?.(); } }}
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
            className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors cursor-pointer ${
              selected ? 'bg-star border-star' : 'border-dust/30 bg-surface/40 hover:border-star/50'
            }`}
          >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-void" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Desktop: single-line grid, no inline labels */}
      <div className="hidden md:grid grid-cols-12 gap-3 flex-1 items-center min-h-[28px]">
        {/* Status + ID */}
        <div className="col-span-2 flex items-center gap-1.5 min-w-0">
          <Badge variant={statusKey} className="w-fit h-[22px] text-[10px] px-2 py-0 uppercase font-bold shrink-0">
            {label}
          </Badge>
          <Link
            href={`/stela/${id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10px] text-dust tracking-wider uppercase hover:text-star transition-colors truncate"
          >
            #{id.slice(2, 8)}
          </Link>
          {pendingShares && (
            <span className="text-[8px] text-cosmic font-semibold shrink-0" title={`${pendingShares} shares pending redemption`}>
              {pendingShares}sh
            </span>
          )}
          <InfoTooltip content={STATUS_DESCRIPTIONS[status] ?? 'Inscription status'} side="right" />
        </div>

        {/* Debt */}
        <div className="col-span-3">
          <AssetsByRole assets={assets} role="debt" />
        </div>

        {/* Interest */}
        <div className="col-span-2">
          <AssetsByRole assets={assets} role="interest" />
        </div>

        {/* Collateral */}
        <div className="col-span-3">
          <AssetsByRole assets={assets} role="collateral" />
        </div>

        {/* Action */}
        <div className="col-span-2 flex flex-col items-end gap-0.5">
          {onAction ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAction() }}
                disabled={actionPending}
                className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
              </button>
              {!isSwap && (
                <span className="text-dust text-[9px]">{formatDuration(Number(duration))}</span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Badge variant={isSwap ? 'pending' : 'default'} className="w-fit h-[20px] text-[9px] px-1.5 py-0 uppercase font-bold">
                {isSwap ? 'Swap' : 'Loan'}
              </Badge>
              {!isSwap && (
                <span className="text-chalk text-[11px] font-medium">{formatDuration(Number(duration))}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: compact two-line layout */}
      <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant={statusKey} className="w-fit h-[22px] text-[10px] px-2 py-0 uppercase font-bold shrink-0">
              {label}
            </Badge>
            <Badge variant={isSwap ? 'pending' : 'default'} className="w-fit h-[20px] text-[9px] px-1.5 py-0 uppercase font-bold shrink-0">
              {isSwap ? 'Swap' : 'Loan'}
            </Badge>
            <Link
              href={`/stela/${id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[10px] text-dust tracking-wider uppercase hover:text-star transition-colors"
            >
              #{id.slice(2, 8)}
            </Link>
          </div>
          {onAction ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAction() }}
              disabled={actionPending}
              className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
            </button>
          ) : (
            <span className="text-chalk text-[11px] font-medium shrink-0">{formatDuration(Number(duration))}</span>
          )}
        </div>
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[8px] text-dust uppercase">D</span>
            <AssetsByRole assets={assets} role="debt" />
          </div>
          <div className="text-edge/40">|</div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[8px] text-dust uppercase">C</span>
            <AssetsByRole assets={assets} role="collateral" />
          </div>
        </div>
      </div>
    </div>
  )

  if (selectable) return row

  return (
    <Link href={`/stela/${id}`} className="block" aria-label={`View inscription ${id.slice(2, 8)}`}>
      {row}
    </Link>
  )
}
