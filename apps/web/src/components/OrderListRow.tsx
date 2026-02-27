'use client'

import { useMemo } from 'react'
import { formatDuration } from '@/lib/format'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { getOrderStatusBadgeVariant, getOrderStatusLabel, STATUS_DESCRIPTIONS } from '@/lib/status'
import { InfoTooltip } from '@/components/InfoTooltip'
import { CompactAssetSummary } from '@/components/CompactAssetSummary'
import { Badge } from '@/components/ui/badge'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

interface OrderListRowProps {
  order: OrderRow
}

export function OrderListRow({ order }: OrderListRowProps) {
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

  return (
    <Link href={`/order/${order.id}`} className="block" aria-label={`View order ${order.id.slice(0, 8)}`}>
      <div className="group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 bg-surface/20 border-edge/50 hover:border-edge hover:bg-surface/40">
        {/* Spacer for alignment with inscription rows */}
        <div className="shrink-0 w-5 h-5" />

        {/* Desktop: 12-column grid */}
        <div className="hidden md:grid grid-cols-12 gap-4 flex-1 items-center">
          {/* Status & ID */}
          <div className="col-span-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant={statusVariant} className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
                {statusLabel}
              </Badge>
              <span className="text-[8px] text-ash/60 uppercase tracking-wider">off-chain</span>
              <InfoTooltip content={STATUS_DESCRIPTIONS[order.status] ?? 'Order status'} side="right" />
            </div>
            <span className="font-mono text-[10px] text-ash tracking-wider uppercase">
              #{order.id.slice(0, 8)}
            </span>
          </div>

          {/* Debt */}
          <div className="col-span-3 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
            <CompactAssetSummary assets={debtAssets} />
          </div>

          {/* Interest */}
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Interest</span>
            <CompactAssetSummary assets={interestAssets} />
          </div>

          {/* Collateral */}
          <div className="col-span-3 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
            <CompactAssetSummary assets={collateralAssets} />
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
              <Badge variant={statusVariant} className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
                {statusLabel}
              </Badge>
              <span className="text-[8px] text-ash/60 uppercase tracking-wider">off-chain</span>
              <span className="font-mono text-[10px] text-ash tracking-wider uppercase">
                #{order.id.slice(0, 8)}
              </span>
            </div>
            <span className="text-chalk text-xs font-medium shrink-0">{formatDuration(Number(duration))}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
              <CompactAssetSummary assets={debtAssets} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
              <CompactAssetSummary assets={collateralAssets} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
