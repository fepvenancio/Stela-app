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
      className={`group flex items-center gap-3 px-4 py-3 border-b transition-colors duration-100 ${
        selectable ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'bg-star/5 border-star/20'
          : 'border-edge/15 hover:bg-surface/30'
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

      {/* Desktop: Uniswap-style grid */}
      <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_72px_90px] gap-4 flex-1 items-center">
        {/* Pool pair */}
        <PoolPairDisplay
          debtAssets={debtAssets}
          collateralAssets={collateralAssets}
          interestAssets={interestAssets}
          id={id}
        />

        {/* Type */}
        <div className="flex justify-center">
          <Badge variant={isSwap ? 'pending' : 'default'} className="h-[20px] text-[9px] px-2 py-0 uppercase font-bold">
            {isSwap ? 'Swap' : 'Loan'}
          </Badge>
        </div>

        {/* Yield */}
        <div className="text-right">
          <span className={`text-sm tabular-nums font-medium ${!isSwap && yieldDisplay !== '—' ? 'text-aurora' : 'text-dust'}`}>
            {yieldDisplay}
          </span>
        </div>

        {/* Duration */}
        <div className="text-right">
          <span className="text-sm text-chalk tabular-nums">
            {isSwap ? 'Instant' : formatDuration(Number(duration))}
          </span>
          {maturityTimestamp && !countdown.isExpired && (
            <span
              suppressHydrationWarning
              className={`block text-[10px] tabular-nums ${countdown.isUrgent ? 'text-nova' : countdown.isAtRisk ? 'text-star' : 'text-aurora'}`}
            >
              {countdown.formatted}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-center items-center gap-1">
          <Badge variant={statusKey} className="h-[20px] text-[9px] px-2 py-0 uppercase font-bold">
            {label}
          </Badge>
          {maturityTimestamp && countdown.isAtRisk && !countdown.isExpired && (
            <Badge variant="atrisk" className={`h-[20px] text-[9px] px-2 py-0 uppercase font-bold ${countdown.isUrgent ? 'animate-pulse' : ''}`}>
              At Risk
            </Badge>
          )}
        </div>

        {/* Action */}
        <div className="flex justify-end">
          {onAction ? (
            confirming ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(false); onAction() }}
                  disabled={actionPending}
                  className="h-7 px-2 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase rounded-md transition-all disabled:opacity-40 cursor-pointer"
                >
                  {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(false) }}
                  className="h-7 px-2 bg-surface border border-edge/30 text-dust text-[10px] font-bold uppercase rounded-md hover:text-chalk cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(true) }}
                disabled={actionPending}
                className="h-7 px-3 bg-star/10 hover:bg-star/20 text-star text-[10px] font-bold uppercase tracking-wider rounded-md transition-all disabled:opacity-40 cursor-pointer border border-star/20 hover:border-star/40"
              >
                {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
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
              className="h-8 px-3 bg-star/10 hover:bg-star/20 text-star text-[10px] font-bold uppercase tracking-wider rounded-md transition-all disabled:opacity-40 cursor-pointer border border-star/20 shrink-0"
            >
              {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
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
            <span className="text-[10px] text-aurora font-medium">{yieldDisplay}</span>
          )}
          <span className="text-[10px] text-dust">{isSwap ? 'Instant' : formatDuration(Number(duration))}</span>
          {maturityTimestamp && !countdown.isExpired && (
            <span
              suppressHydrationWarning
              className={`text-[10px] tabular-nums ${countdown.isUrgent ? 'text-nova' : countdown.isAtRisk ? 'text-star' : 'text-aurora'}`}
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
