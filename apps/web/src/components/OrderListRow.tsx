'use client'

import { useMemo } from 'react'
import { formatDuration } from '@/lib/format'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { getOrderStatusBadgeVariant, getOrderStatusLabel, STATUS_DESCRIPTIONS } from '@/lib/status'
import { InfoTooltip } from '@/components/InfoTooltip'
import { CompactAssetSummary } from '@/components/CompactAssetSummary'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

interface OrderListRowProps {
  order: OrderRow
  selectable?: boolean
  selected?: boolean
  onSelect?: () => void
  onAction?: () => void
  actionPending?: boolean
}

export function OrderListRow({ order, selectable, selected, onSelect, onAction, actionPending }: OrderListRowProps) {
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

  const inner = (
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
            aria-label={`Select order ${order.id.slice(0, 8)}`}
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

      {/* Desktop: single-line grid */}
      <div className="hidden md:grid grid-cols-12 gap-3 flex-1 items-center min-h-[28px]">
        {/* Status + ID */}
        <div className="col-span-2 flex items-center gap-1.5 min-w-0">
          <Badge variant={statusVariant} className="w-fit h-[22px] text-[10px] px-2 py-0 uppercase font-bold shrink-0">
            {statusLabel}
          </Badge>
          <Link
            href={`/stela/${order.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10px] text-dust tracking-wider uppercase truncate hover:text-star transition-colors"
          >
            #{order.id.slice(0, 8)}
          </Link>
          <span className="text-[7px] text-ash/40 uppercase tracking-wider shrink-0">oc</span>
          <InfoTooltip content={STATUS_DESCRIPTIONS[order.status] ?? 'Order status'} side="right" />
        </div>

        {/* Debt */}
        <div className="col-span-3">
          <CompactAssetSummary assets={debtAssets} />
        </div>

        {/* Interest */}
        <div className="col-span-2">
          <CompactAssetSummary assets={interestAssets} />
        </div>

        {/* Collateral */}
        <div className="col-span-3">
          <CompactAssetSummary assets={collateralAssets} />
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
            <Badge variant={statusVariant} className="w-fit h-[22px] text-[10px] px-2 py-0 uppercase font-bold shrink-0">
              {statusLabel}
            </Badge>
            <Badge variant={isSwap ? 'pending' : 'default'} className="w-fit h-[20px] text-[9px] px-1.5 py-0 uppercase font-bold shrink-0">
              {isSwap ? 'Swap' : 'Loan'}
            </Badge>
            <span className="text-[7px] text-ash/40 uppercase tracking-wider">oc</span>
            <Link
              href={`/stela/${order.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[10px] text-dust tracking-wider uppercase hover:text-star transition-colors"
            >
              #{order.id.slice(0, 8)}
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
            <CompactAssetSummary assets={debtAssets} />
          </div>
          <div className="text-edge/40">|</div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[8px] text-dust uppercase">C</span>
            <CompactAssetSummary assets={collateralAssets} />
          </div>
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
