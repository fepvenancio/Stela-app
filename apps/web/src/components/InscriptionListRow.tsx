'use client'

import { useMemo, useState } from 'react'
import { formatDuration } from '@/lib/format'
import { getStatusBadgeVariant, getStatusLabel } from '@/lib/status'
import { PoolPairDisplay } from '@/components/PoolPairDisplay'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { AssetRow } from '@/types/api'
import Link from 'next/link'
import { computeYieldPercent } from '@/lib/filter-utils'
import { useCountdown } from '@/hooks/useCountdown'

interface InscriptionListRowProps {
  id: string
  status: string
  creator: string
  multiLender: boolean
  duration: string
  assets: AssetRow[]
  pendingShares?: string
  signedAt?: string
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
  onAction?: () => void
  actionPending?: boolean
  actionLabel?: string
}

export function InscriptionListRow({
  id,
  status,
  duration,
  assets,
  signedAt,
  selectable,
  selected,
  onSelect,
  onAction,
  actionPending,
  actionLabel,
}: InscriptionListRowProps) {
  const statusKey = getStatusBadgeVariant(status)
  const label = getStatusLabel(status)
  const isSwap = Number(duration) === 0
  const [confirming, setConfirming] = useState(false)

  const maturityTimestamp = useMemo(() => {
    if (status !== 'filled' || !signedAt || Number(signedAt) <= 0) return null
    return Number(signedAt) + Number(duration)
  }, [status, signedAt, duration])
  const countdown = useCountdown(maturityTimestamp)

  const debtAssets = useMemo(() => assets.filter((a) => a.asset_role === 'debt'), [assets])
  const interestAssets = useMemo(() => assets.filter((a) => a.asset_role === 'interest'), [assets])
  const collateralAssets = useMemo(() => assets.filter((a) => a.asset_role === 'collateral'), [assets])

  const yieldDisplay = useMemo(() => {
    if (isSwap) return '—'
    const pct = computeYieldPercent(debtAssets, interestAssets)
    if (pct === null) return '—'
    return `${pct.toFixed(1)}%`
  }, [debtAssets, interestAssets, isSwap])

  const row = (
    <div
      onClick={selectable ? () => onSelect?.() : undefined}
      className={`group flex items-center gap-3 px-3 sm:px-4 py-3 border-b transition-colors duration-100 overflow-hidden ${
        selectable ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'bg-accent/5 border-accent/20'
          : 'border-border/15 hover:bg-surface/30'
      }`}
    >
      {/* Checkbox — outer div is larger touch target */}
      {selectable && (
        <div
          className="shrink-0 w-8 h-8 md:w-5 md:h-5 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        >
          <div
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select inscription ${id.slice(2, 8)}`}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect?.(); } }}
            className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors cursor-pointer ${
              selected ? 'bg-accent border-accent' : 'border-dust/30 bg-surface/40 hover:border-accent/50'
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

      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-[1fr_56px_64px_80px_72px_110px] gap-5 flex-1 items-center">
        <PoolPairDisplay
          debtAssets={debtAssets}
          collateralAssets={collateralAssets}
          interestAssets={interestAssets}
          id={id}
        />

        {/* Type */}
        <span className={`text-xs text-center ${isSwap ? 'text-gray-400' : 'text-white'}`}>
          {isSwap ? 'Swap' : 'Loan'}
        </span>

        {/* Yield */}
        <span className={`text-sm text-right tabular-nums font-medium ${!isSwap && yieldDisplay !== '—' ? 'text-green-500' : 'text-gray-400'}`}>
          {yieldDisplay}
        </span>

        {/* Duration */}
        <div className="text-right">
          <span className="text-sm text-white tabular-nums">
            {isSwap ? 'Instant' : formatDuration(Number(duration))}
          </span>
          {maturityTimestamp && !countdown.isExpired && (
            <span
              suppressHydrationWarning
              className={`block text-[11px] tabular-nums ${countdown.isUrgent ? 'text-red-500' : countdown.isAtRisk ? 'text-accent' : 'text-green-500'}`}
            >
              {countdown.formatted}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-center items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            statusKey === 'filled' || statusKey === 'repaid' ? 'bg-green-500' :
            statusKey === 'open' || statusKey === 'partial' ? 'bg-accent' :
            statusKey === 'overdue' || statusKey === 'liquidated' ? 'bg-red-500' : 'bg-dust'
          }`} />
          <span className={`text-xs capitalize ${
            countdown.isAtRisk && !countdown.isExpired ? (countdown.isUrgent ? 'text-red-500' : 'text-accent') : 'text-white'
          }`}>
            {countdown.isAtRisk && !countdown.isExpired ? 'At risk' : label.toLowerCase()}
          </span>
        </div>

        {/* Action */}
        <div className="flex justify-end">
          {onAction ? (
            confirming ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(false); onAction() }}
                  disabled={actionPending}
                  className="h-8 w-[46px] bg-accent hover:bg-accent-bright text-void text-xs font-semibold rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center"
                >
                  {actionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(false) }}
                  className="h-8 w-[46px] bg-surface border border-border/30 text-gray-400 text-xs font-semibold rounded-lg hover:text-white cursor-pointer flex items-center justify-center"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(true) }}
                disabled={actionPending}
                className="h-8 w-[100px] rounded-lg text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/40"
              >
                {actionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (actionLabel ?? (isSwap ? 'Swap' : 'Lend'))}
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Mobile: compact card layout */}
      <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <PoolPairDisplay
            debtAssets={debtAssets}
            collateralAssets={collateralAssets}
            interestAssets={interestAssets}
            id={id}
          />
          {onAction ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAction() }}
              disabled={actionPending}
              className="h-8 min-w-[90px] bg-accent/10 hover:bg-accent/20 text-accent font-bold uppercase rounded-md transition-all disabled:opacity-40 cursor-pointer border border-accent/20 shrink-0 flex items-center justify-center"
            >
              {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px] leading-none truncate px-1">{actionLabel ?? (isSwap ? 'Swap' : 'Lend')}</span>}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={statusKey} className="h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold">
            {label}
          </Badge>
          {maturityTimestamp && countdown.isAtRisk && !countdown.isExpired && (
            <Badge variant="atrisk" className={`h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold ${countdown.isUrgent ? 'animate-pulse' : ''}`}>
              At Risk
            </Badge>
          )}
          <Badge variant={isSwap ? 'pending' : 'default'} className="h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold">
            {isSwap ? 'Swap' : 'Loan'}
          </Badge>
          {!isSwap && yieldDisplay !== '—' && (
            <span className="text-[10px] text-green-500 font-medium">{yieldDisplay}</span>
          )}
          <span className="text-[10px] text-gray-400">{isSwap ? 'Instant' : formatDuration(Number(duration))}</span>
          {maturityTimestamp && !countdown.isExpired && (
            <span
              suppressHydrationWarning
              className={`text-[10px] tabular-nums ${countdown.isUrgent ? 'text-red-500' : countdown.isAtRisk ? 'text-accent' : 'text-green-500'}`}
            >
              {countdown.formatted}
            </span>
          )}
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
