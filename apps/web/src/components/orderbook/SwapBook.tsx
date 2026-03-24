'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { OrderBookRow } from './OrderBookRow'
import { SpreadRow } from './SpreadRow'
import type { SwapLevel } from '@/types/orderbook'

interface SwapBookProps {
  asks: SwapLevel[]
  bids: SwapLevel[]
  baseSymbol: string
  baseDecimals: number
  quoteSymbol: string
}

const MAX_ROWS_PER_SIDE = 8

export function SwapBook({ asks, bids, baseSymbol, baseDecimals, quoteSymbol }: SwapBookProps) {
  // Asks: sorted worst-to-best (highest rate at top, best rate at bottom near spread)
  const visibleAsks = useMemo(() => {
    const sorted = [...asks].sort((a, b) => b.rate - a.rate)
    return sorted.slice(0, MAX_ROWS_PER_SIDE)
  }, [asks])

  // Bids: sorted best-to-worst (highest rate at top near spread)
  const visibleBids = useMemo(() => {
    const sorted = [...bids].sort((a, b) => b.rate - a.rate)
    return sorted.slice(0, MAX_ROWS_PER_SIDE)
  }, [bids])

  const askMaxCumulative = useMemo(() => {
    if (visibleAsks.length === 0) return '0'
    // The last ask (worst rate) has the highest cumulative
    return visibleAsks[0]?.cumulative ?? '0'
  }, [visibleAsks])

  const bidMaxCumulative = useMemo(() => {
    if (visibleBids.length === 0) return '0'
    return visibleBids[visibleBids.length - 1]?.cumulative ?? '0'
  }, [visibleBids])

  const bestAsk = visibleAsks.length > 0 ? visibleAsks[visibleAsks.length - 1]?.rate ?? 0 : 0
  const bestBid = visibleBids.length > 0 ? visibleBids[0]?.rate ?? 0 : 0

  const isEmpty = asks.length === 0 && bids.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-400">No swap orders yet</p>
        <p className="text-[10px] text-gray-500 mt-1">Swap orders will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full">
      {/* Column headers */}
      <div className="flex items-center h-7 px-3 border-b border-border/15 text-[10px] text-gray-500 uppercase tracking-wider">
        <span className="w-[72px] shrink-0 text-left">Rate</span>
        <span className="flex-1 text-right">Amount ({baseSymbol})</span>
        <span className="hidden md:block w-[100px] text-right">Total</span>
      </div>

      {/* Asks (top half) — worst to best, so best is near spread */}
      <div className={cn('flex flex-col', asks.length > MAX_ROWS_PER_SIDE && 'max-h-[256px] overflow-y-auto')}>
        {visibleAsks.length === 0 ? (
          <div className="flex items-center justify-center h-8 text-[10px] text-gray-500">
            No asks
          </div>
        ) : (
          visibleAsks.map((level, i) => (
            <OrderBookRow
              key={`ask-${level.rate}-${i}`}
              rate={level.rate}
              amount={level.totalAmount}
              cumulative={level.cumulative}
              maxCumulative={askMaxCumulative}
              orderCount={level.orderCount}
              side="ask"
              highlighted={i === visibleAsks.length - 1}
              decimals={baseDecimals}
              symbol={baseSymbol}
            />
          ))
        )}
      </div>

      {/* Spread row */}
      <SpreadRow bestAsk={bestAsk} bestBid={bestBid} symbol={quoteSymbol} />

      {/* Bids (bottom half) — best to worst, so best is near spread */}
      <div className={cn('flex flex-col', bids.length > MAX_ROWS_PER_SIDE && 'max-h-[256px] overflow-y-auto')}>
        {visibleBids.length === 0 ? (
          <div className="flex items-center justify-center h-8 text-[10px] text-gray-500">
            No bids
          </div>
        ) : (
          visibleBids.map((level, i) => (
            <OrderBookRow
              key={`bid-${level.rate}-${i}`}
              rate={level.rate}
              amount={level.totalAmount}
              cumulative={level.cumulative}
              maxCumulative={bidMaxCumulative}
              orderCount={level.orderCount}
              side="bid"
              highlighted={i === 0}
              decimals={baseDecimals}
              symbol={baseSymbol}
            />
          ))
        )}
      </div>
    </div>
  )
}
