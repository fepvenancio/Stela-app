'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatTokenValue } from '@/lib/format'
import { OrderBookRow } from './OrderBookRow'
import type { LendingLevel } from '@/types/orderbook'

interface LendingBookProps {
  asks: LendingLevel[]
  totalAskVolume: string
  baseSymbol: string
  baseDecimals: number
}

const MAX_VISIBLE_ROWS = 15

export function LendingBook({ asks, totalAskVolume, baseSymbol, baseDecimals }: LendingBookProps) {
  const maxCumulative = useMemo(() => {
    if (asks.length === 0) return '0'
    return asks[asks.length - 1]?.cumulative ?? '0'
  }, [asks])

  const visibleAsks = useMemo(() => asks.slice(0, MAX_VISIBLE_ROWS), [asks])
  const totalOrders = useMemo(() => asks.reduce((sum, lvl) => sum + lvl.orderCount, 0), [asks])
  const bestApr = asks.length > 0 ? asks[0]?.apr : null

  if (asks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-400">No borrow requests yet</p>
        <p className="text-[10px] text-gray-500 mt-1">Orders will appear here when borrowers create requests</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full">
      {/* Column headers */}
      <div className="flex items-center h-7 px-3 border-b border-border/15 text-[10px] text-gray-500 uppercase tracking-wider">
        <span className="w-[72px] shrink-0 text-left">APR</span>
        <span className="flex-1 text-right">Amount</span>
        <span className="hidden md:block w-[100px] text-right">Total</span>
      </div>

      {/* Order rows */}
      <div className={cn('flex flex-col', asks.length > MAX_VISIBLE_ROWS && 'max-h-[480px] overflow-y-auto')}>
        {visibleAsks.map((level, i) => (
          <OrderBookRow
            key={`${level.apr}-${i}`}
            apr={level.apr}
            amount={level.totalAmount}
            cumulative={level.cumulative}
            maxCumulative={maxCumulative}
            orderCount={level.orderCount}
            side="ask"
            highlighted={i === 0}
            decimals={baseDecimals}
            symbol={baseSymbol}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {asks.length > MAX_VISIBLE_ROWS && (
        <div className="flex items-center justify-center h-6 text-[10px] text-gray-500 border-t border-border/10">
          +{asks.length - MAX_VISIBLE_ROWS} more level{asks.length - MAX_VISIBLE_ROWS !== 1 ? 's' : ''}
        </div>
      )}

      {/* Summary stats */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/20 text-[10px] gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-gray-500">
            Volume:{' '}
            <span className="text-white font-mono tabular-nums">
              {formatTokenValue(totalAskVolume, baseDecimals)} {baseSymbol}
            </span>
          </span>
          <span className="text-gray-500">
            Orders:{' '}
            <span className="text-white font-mono tabular-nums">{totalOrders}</span>
          </span>
        </div>
        {bestApr !== null && (
          <span className="text-gray-500">
            Best APR:{' '}
            <span className="text-rose-500 font-mono tabular-nums">{bestApr.toFixed(2)}%</span>
          </span>
        )}
      </div>
    </div>
  )
}
