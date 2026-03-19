'use client'

import { useMemo, useState } from 'react'
import { formatDuration } from '@/lib/format'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { getOrderStatusBadgeVariant, getOrderStatusLabel } from '@/lib/status'
import { PoolPairDisplay } from '@/components/PoolPairDisplay'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'
import { computeYieldPercent } from '@/lib/filter-utils'

interface OrderListRowProps {
  order: OrderRow
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
  onAction?: () => void
  actionPending?: boolean
  actionLabel?: string
}

export function OrderListRow({ order, selectable, selected, onSelect, onAction, actionPending, actionLabel }: OrderListRowProps) {
  const orderData = useMemo(() => {
    if (!order.order_data) return normalizeOrderData({})
    const raw: RawOrderData = typeof order.order_data === 'string'
      ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
      : order.order_data as unknown as RawOrderData
    return normalizeOrderData(raw)
  }, [order.order_data])

  const { debtAssets, interestAssets, collateralAssets, duration } = orderData
  const statusVariant = getOrderStatusBadgeVariant(order.status)
  const statusLabel = getOrderStatusLabel(order.status)
  const isSwap = Number(duration) === 0
  const [confirming, setConfirming] = useState(false)

  const yieldDisplay = useMemo(() => {
    if (isSwap) return '—'
    const pct = computeYieldPercent(debtAssets, interestAssets)
    if (pct === null) return '—'
    return `${pct.toFixed(1)}%`
  }, [debtAssets, interestAssets, isSwap])

  const inner = (
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
            aria-label={`Select order ${order.id.slice(0, 8)}`}
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
      <div className="hidden md:grid grid-cols-[1fr_72px_72px_80px_80px_120px] gap-4 flex-1 items-center">
        {/* Pool pair */}
        <PoolPairDisplay
          debtAssets={debtAssets}
          collateralAssets={collateralAssets}
          interestAssets={interestAssets}
          id={order.id}
          isOffchain
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
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <Badge variant={statusVariant} className="h-[20px] text-[9px] px-2 py-0 uppercase font-bold">
            {statusLabel}
          </Badge>
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
                  className="h-8 px-3 bg-star hover:bg-star-bright text-void text-[11px] font-bold uppercase rounded-md transition-all disabled:opacity-40 cursor-pointer"
                >
                  {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(false) }}
                  className="h-8 px-3 bg-surface border border-edge/30 text-dust text-[11px] font-bold uppercase rounded-md hover:text-chalk cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirming(true) }}
                disabled={actionPending}
                className="h-8 px-4 bg-star/10 hover:bg-star/20 text-star text-[11px] font-bold uppercase tracking-wider rounded-md transition-all disabled:opacity-40 cursor-pointer border border-star/20 hover:border-star/40"
              >
                {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : actionLabel ?? (isSwap ? 'Swap' : 'Lend')}
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
            id={order.id}
            isOffchain
          />
          {onAction ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAction() }}
              disabled={actionPending}
              className="h-8 px-3 bg-star/10 hover:bg-star/20 text-star text-[10px] font-bold uppercase tracking-wider rounded-md transition-all disabled:opacity-40 cursor-pointer border border-star/20 shrink-0"
            >
              {actionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : actionLabel ?? (isSwap ? 'Swap' : 'Lend')}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={statusVariant} className="h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold">
            {statusLabel}
          </Badge>
          <Badge variant={isSwap ? 'pending' : 'default'} className="h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold">
            {isSwap ? 'Swap' : 'Loan'}
          </Badge>
          {!isSwap && yieldDisplay !== '—' && (
            <span className="text-[10px] text-aurora font-medium">{yieldDisplay}</span>
          )}
          <span className="text-[10px] text-dust">{isSwap ? 'Instant' : formatDuration(Number(duration))}</span>
        </div>
      </div>
    </div>
  )

  if (selectable || onAction) return inner

  return (
    <Link href={`/stela/${order.id}`} className="block" aria-label={`View order ${order.id.slice(0, 8)}`}>
      {inner}
    </Link>
  )
}
