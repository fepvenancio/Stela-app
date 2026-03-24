'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatTokenValue } from '@/lib/format'

interface OrderBookRowProps {
  apr?: number
  rate?: number
  amount: string
  cumulative: string
  maxCumulative: string
  orderCount: number
  side: 'ask' | 'bid'
  highlighted?: boolean
  decimals: number
  symbol: string
}

export function OrderBookRow({
  apr,
  rate,
  amount,
  cumulative,
  maxCumulative,
  orderCount,
  side,
  highlighted,
  decimals,
  symbol,
}: OrderBookRowProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const depthPercent = useMemo(() => {
    const cum = BigInt(cumulative || '0')
    const max = BigInt(maxCumulative || '1')
    if (max === 0n) return 0
    return Number((cum * 100n) / max)
  }, [cumulative, maxCumulative])

  const priceDisplay = useMemo(() => {
    if (apr !== undefined) return `${apr.toFixed(2)}%`
    if (rate !== undefined) return rate.toFixed(6)
    return '--'
  }, [apr, rate])

  const amountDisplay = useMemo(() => formatTokenValue(amount, decimals), [amount, decimals])
  const cumulativeDisplay = useMemo(() => formatTokenValue(cumulative, decimals), [cumulative, decimals])

  const isAsk = side === 'ask'
  const depthColor = isAsk ? 'bg-rose-500/15' : 'bg-emerald-500/15'
  const priceColor = isAsk ? 'text-rose-500' : 'text-emerald-500'

  return (
    <div
      className={cn(
        'relative flex items-center h-8 md:h-[32px] px-3 transition-colors duration-75 cursor-default group',
        highlighted ? 'bg-surface-hover/60' : 'hover:bg-surface/40',
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Depth bar */}
      <div
        className={cn('absolute inset-y-0 h-full', depthColor, isAsk ? 'right-0' : 'left-0')}
        style={{ width: `${depthPercent}%` }}
      />

      {/* Row content */}
      <div className="relative z-[1] flex items-center w-full gap-2">
        {/* Price / APR */}
        <span className={cn('font-mono text-xs tabular-nums w-[72px] shrink-0 text-left', priceColor)}>
          {priceDisplay}
        </span>

        {/* Amount */}
        <span className="font-mono text-xs tabular-nums text-white flex-1 text-right truncate">
          {amountDisplay}
        </span>

        {/* Cumulative — hidden on mobile */}
        <span className="hidden md:block font-mono text-xs tabular-nums text-gray-400 w-[100px] text-right truncate">
          {cumulativeDisplay}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && orderCount > 0 && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-3 py-2 bg-surface border border-border rounded-md shadow-lg pointer-events-none whitespace-nowrap">
          <p className="text-[10px] text-gray-400">
            {orderCount} order{orderCount !== 1 ? 's' : ''} at this level
          </p>
          <p className="text-[10px] text-white mt-0.5">
            {amountDisplay} {symbol}
          </p>
        </div>
      )}
    </div>
  )
}
