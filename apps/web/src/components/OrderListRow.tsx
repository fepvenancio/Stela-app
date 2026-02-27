'use client'

import { useMemo } from 'react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress } from '@/lib/address'
import { formatTokenValue, formatDuration } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Badge } from '@/components/ui/badge'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

interface SerializedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

interface RawOrderData {
  debt_assets?: SerializedAsset[]
  interest_assets?: SerializedAsset[]
  collateral_assets?: SerializedAsset[]
  debtAssets?: SerializedAsset[]
  interestAssets?: SerializedAsset[]
  collateralAssets?: SerializedAsset[]
  multi_lender?: boolean
  multiLender?: boolean
  duration?: string
}

interface ParsedOrderData {
  debtAssets: SerializedAsset[]
  interestAssets: SerializedAsset[]
  collateralAssets: SerializedAsset[]
  duration: string
  multiLender: boolean
}

function normalizeOrderData(raw: RawOrderData): ParsedOrderData {
  return {
    debtAssets: raw.debt_assets ?? raw.debtAssets ?? [],
    interestAssets: raw.interest_assets ?? raw.interestAssets ?? [],
    collateralAssets: raw.collateral_assets ?? raw.collateralAssets ?? [],
    duration: raw.duration ?? '0',
    multiLender: raw.multi_lender ?? raw.multiLender ?? false,
  }
}

function CompactOrderAssetSummary({ assets }: { assets: SerializedAsset[] }) {
  if (assets.length === 0) return <span className="text-ash/50 text-[10px]">None</span>

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {assets.map((a, i) => {
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

interface OrderListRowProps {
  order: OrderRow
}

export function OrderListRow({ order }: OrderListRowProps) {
  const orderData = useMemo<ParsedOrderData>(() => {
    if (!order.order_data) return normalizeOrderData({})
    const raw: RawOrderData = typeof order.order_data === 'string'
      ? (() => { try { return JSON.parse(order.order_data) } catch { return {} } })()
      : order.order_data as unknown as RawOrderData
    return normalizeOrderData(raw)
  }, [order.order_data])

  const { debtAssets, interestAssets, collateralAssets, duration } = orderData

  return (
    <Link href={`/order/${order.id}`} className="block" aria-label={`View order ${order.id.slice(0, 8)}`}>
      <div className="group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 bg-surface/20 border-edge/50 hover:border-edge hover:bg-surface/40">
        {/* Spacer for alignment with inscription rows */}
        <div className="shrink-0 w-5 h-5" />

        {/* Desktop: 12-column grid */}
        <div className="hidden md:grid grid-cols-12 gap-4 flex-1 items-center">
          {/* Status & ID */}
          <div className="col-span-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="default" className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
                Off-chain
              </Badge>
            </div>
            <span className="font-mono text-[10px] text-ash tracking-wider uppercase">
              #{order.id.slice(0, 8)}
            </span>
          </div>

          {/* Debt */}
          <div className="col-span-3 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
            <CompactOrderAssetSummary assets={debtAssets} />
          </div>

          {/* Interest */}
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Interest</span>
            <CompactOrderAssetSummary assets={interestAssets} />
          </div>

          {/* Collateral */}
          <div className="col-span-3 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
            <CompactOrderAssetSummary assets={collateralAssets} />
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
              <Badge variant="default" className="w-fit h-4 text-[9px] px-1.5 py-0 uppercase font-bold">
                Off-chain
              </Badge>
              <span className="font-mono text-[10px] text-ash tracking-wider uppercase">
                #{order.id.slice(0, 8)}
              </span>
            </div>
            <span className="text-chalk text-xs font-medium shrink-0">{formatDuration(Number(duration))}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Debt</span>
              <CompactOrderAssetSummary assets={debtAssets} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dust uppercase tracking-widest font-semibold">Collateral</span>
              <CompactOrderAssetSummary assets={collateralAssets} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
