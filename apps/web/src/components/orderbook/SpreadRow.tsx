'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface SpreadRowProps {
  bestAsk: number
  bestBid: number
  symbol: string
}

export function SpreadRow({ bestAsk, bestBid, symbol }: SpreadRowProps) {
  const spread = useMemo(() => {
    if (bestAsk <= 0 || bestBid <= 0) return null
    const value = bestAsk - bestBid
    const mid = (bestAsk + bestBid) / 2
    const pct = mid > 0 ? (value / mid) * 100 : 0
    return { value, pct }
  }, [bestAsk, bestBid])

  if (!spread) {
    return (
      <div className="flex items-center justify-center h-9 px-3 border-y border-border/20">
        <span className="text-xs text-gray-400">No spread data</span>
      </div>
    )
  }

  const direction = spread.value > 0 ? 'up' : spread.value < 0 ? 'down' : 'neutral'

  return (
    <div className="flex items-center justify-center h-9 px-3 border-y border-border/20 gap-2">
      {/* Direction arrow */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={cn(
          'shrink-0',
          direction === 'up' && 'text-emerald-500',
          direction === 'down' && 'text-rose-500',
          direction === 'neutral' && 'text-gray-400',
        )}
      >
        {direction === 'up' && (
          <path d="M6 2L10 7H2L6 2Z" fill="currentColor" />
        )}
        {direction === 'down' && (
          <path d="M6 10L2 5H10L6 10Z" fill="currentColor" />
        )}
        {direction === 'neutral' && (
          <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>

      {/* Spread value */}
      <span className="font-mono text-xs tabular-nums text-accent">
        {spread.value.toFixed(6)}
      </span>

      {/* Spread percentage */}
      <span className="text-[10px] text-gray-400">
        ({spread.pct.toFixed(2)}%)
      </span>

      {/* Symbol */}
      <span className="text-[10px] text-gray-500 hidden sm:inline">
        {symbol}
      </span>
    </div>
  )
}
