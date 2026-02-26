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

interface ParsedOrderData {
  debtAssets?: SerializedAsset[]
  interestAssets?: SerializedAsset[]
  collateralAssets?: SerializedAsset[]
  duration?: string
  multiLender?: boolean
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
    if (!order.order_data) return {}
    if (typeof order.order_data === 'string') {
      try {
        return JSON.parse(order.order_data) as ParsedOrderData
      } catch {
        return {}
      }
    }
    return order.order_data as unknown as ParsedOrderData
  }, [order.order_data])

  const debtAssets = orderData.debtAssets ?? []
  const interestAssets = orderData.interestAssets ?? []
  const collateralAssets = orderData.collateralAssets ?? []
  const duration = orderData.duration ?? '0'

  return (
    <Link href={`/order/${order.id}`} className="block">
      <div className="group flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 bg-surface/20 border-edge/50 hover:border-edge hover:bg-surface/40">
        {/* Spacer for alignment with inscription rows */}
        <div className="shrink-0 w-5 h-5" />

        <div className="grid grid-cols-12 gap-4 flex-1 items-center">
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
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold hidden md:block">Debt</span>
            <CompactOrderAssetSummary assets={debtAssets} />
          </div>

          {/* Interest */}
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold hidden md:block">Interest</span>
            <CompactOrderAssetSummary assets={interestAssets} />
          </div>

          {/* Collateral */}
          <div className="col-span-3 flex flex-col gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold hidden md:block">Collateral</span>
            <CompactOrderAssetSummary assets={collateralAssets} />
          </div>

          {/* Duration */}
          <div className="col-span-2 flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-dust uppercase tracking-widest font-semibold hidden md:block">Duration</span>
            <span className="text-chalk text-xs font-medium">{formatDuration(Number(duration))}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
