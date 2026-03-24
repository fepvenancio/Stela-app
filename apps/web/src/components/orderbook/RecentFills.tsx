'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatTokenValue } from '@/lib/format'
import type { OrderBookResponse } from '@/types/orderbook'

interface RecentFillsProps {
  fills: OrderBookResponse['recentFills']
  baseSymbol: string
  baseDecimals: number
}

const MAX_FILLS = 5

function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function RecentFills({ fills, baseSymbol, baseDecimals }: RecentFillsProps) {
  const visibleFills = useMemo(() => {
    return [...fills]
      .sort((a, b) => b.filledAt - a.filledAt)
      .slice(0, MAX_FILLS)
  }, [fills])

  if (visibleFills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-xs text-gray-400">No recent fills</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center h-7 px-3 border-b border-border/15 text-[10px] text-gray-500 uppercase tracking-wider">
        <span className="w-[52px] shrink-0 text-left">Time</span>
        <span className="hidden sm:block w-[48px] text-center">Type</span>
        <span className="w-[64px] text-right">APR/Rate</span>
        <span className="flex-1 text-right">Amount</span>
      </div>

      {/* Fill rows */}
      {visibleFills.map((fill) => {
        const isLending = fill.type === 'lending'
        const priceDisplay = isLending
          ? `${fill.apr.toFixed(2)}%`
          : fill.rate.toFixed(6)

        return (
          <div
            key={fill.id}
            className="flex items-center h-8 md:h-[32px] px-3 border-b border-border/5 hover:bg-surface/30 transition-colors duration-75"
          >
            {/* Time */}
            <span
              suppressHydrationWarning
              className="w-[52px] shrink-0 text-left text-[11px] text-gray-400 font-mono tabular-nums"
            >
              {relativeTime(fill.filledAt)}
            </span>

            {/* Type badge — hidden on mobile */}
            <div className="hidden sm:flex w-[48px] justify-center">
              <span
                className={cn(
                  'inline-flex items-center justify-center h-[18px] px-1.5 rounded text-[9px] font-bold uppercase tracking-wide',
                  isLending
                    ? 'bg-sky-400/15 text-sky-400 border border-sky-400/20'
                    : 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/20',
                )}
              >
                {isLending ? 'Loan' : 'Swap'}
              </span>
            </div>

            {/* Price */}
            <span className="w-[64px] text-right text-[11px] font-mono tabular-nums text-white">
              {priceDisplay}
            </span>

            {/* Amount */}
            <span className="flex-1 text-right text-[11px] font-mono tabular-nums text-white truncate ml-2">
              {formatTokenValue(fill.amount, baseDecimals)} {baseSymbol}
            </span>
          </div>
        )
      })}
    </div>
  )
}
