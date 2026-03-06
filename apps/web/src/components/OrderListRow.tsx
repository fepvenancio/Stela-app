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
    <Link href={`/stela/${order.id}`} className="block" aria-label={`View order ${order.id.slice(0, 8)}`}>
      <div className="group flex items-center gap-3 px-3 py-3 border-b transition-colors duration-100 border-edge/20 hover:bg-surface/30">

        {/* Desktop: single-line grid, no inline labels */}
        <div className="hidden md:grid grid-cols-12 gap-3 flex-1 items-center min-h-[28px]">
          {/* Status + ID */}
          <div className="col-span-2 flex items-center gap-1.5 min-w-0">
            <Badge variant={statusVariant} className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
              {statusLabel}
            </Badge>
            <span className="font-mono text-[10px] text-dust tracking-wider uppercase truncate">
              #{order.id.slice(0, 8)}
            </span>
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

          {/* Duration */}
          <div className="col-span-2 text-right">
            <span className="text-chalk text-[11px] font-medium">{formatDuration(Number(duration))}</span>
          </div>
        </div>

        {/* Mobile: compact two-line layout */}
        <div className="flex md:hidden flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge variant={statusVariant} className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
                {statusLabel}
              </Badge>
              <span className="text-[7px] text-ash/40 uppercase tracking-wider">oc</span>
              <span className="font-mono text-[10px] text-dust tracking-wider uppercase">
                #{order.id.slice(0, 8)}
              </span>
            </div>
            <span className="text-chalk text-[11px] font-medium shrink-0">{formatDuration(Number(duration))}</span>
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
    </Link>
  )
}
