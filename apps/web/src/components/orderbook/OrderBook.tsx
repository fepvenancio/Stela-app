'use client'

import { cn } from '@/lib/utils'
import { DurationFilter } from './DurationFilter'
import { LendingBook } from './LendingBook'
import { SwapBook } from './SwapBook'
import { BookSkeleton } from './BookSkeleton'
import type { OrderBookResponse, DurationFilter as DurationFilterType } from '@/types/orderbook'

interface OrderBookProps {
  data: OrderBookResponse | null
  isLoading: boolean
  mode: 'lending' | 'swap'
  duration: DurationFilterType
  onDurationChange: (d: DurationFilterType) => void
}

export function OrderBook({ data, isLoading, mode, duration, onDurationChange }: OrderBookProps) {
  const hasData = data !== null

  return (
    <div className="flex flex-col w-full rounded-lg border border-edge/30 bg-abyss overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge/20 gap-2 min-w-0">
        <h3 className="text-xs font-display uppercase tracking-wider text-chalk shrink-0">
          Order Book
        </h3>

        {/* Duration filter — only in lending mode */}
        {mode === 'lending' && hasData && (
          <DurationFilter
            value={duration}
            onChange={onDurationChange}
            available={data.durations}
          />
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <BookSkeleton />
      ) : !hasData ? (
        <EmptyState />
      ) : mode === 'lending' ? (
        <LendingBook
          asks={data.lending.asks}
          totalAskVolume={data.lending.totalAskVolume}
          baseSymbol={data.pair.base.symbol}
          baseDecimals={data.pair.base.decimals}
        />
      ) : (
        <SwapBook
          asks={data.swaps.asks}
          bids={data.swaps.bids}
          baseSymbol={data.pair.base.symbol}
          baseDecimals={data.pair.base.decimals}
          quoteSymbol={data.pair.quote.symbol}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center')}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-ash mb-3"
      >
        <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
      <p className="text-sm text-dust">No orders for this pair yet</p>
      <p className="text-[10px] text-ash mt-1">Be the first to create an order</p>
    </div>
  )
}
