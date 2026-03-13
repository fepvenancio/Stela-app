'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatTokenValue } from '@/lib/format'
import { SpreadRow } from './SpreadRow'
import { BookSkeleton } from './BookSkeleton'
import type { OrderBookResponse, LendingLevel, SwapLevel } from '@/types/orderbook'

interface SplitBookProps {
  pairData: OrderBookResponse | null
  reversePairData: OrderBookResponse | null
  isLoading: boolean
  mode: 'lending' | 'swap'
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format deadline as relative time remaining (e.g. "2d 5h", "3h", "12m") */
function expiresIn(deadline: number): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = deadline - now
  if (remaining <= 0) return 'exp'
  if (remaining < 3600) return `${Math.ceil(remaining / 60)}m`
  if (remaining < 86400) return `${Math.floor(remaining / 3600)}h`
  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

/* ------------------------------------------------------------------ */
/*  Individual stela row                                               */
/* ------------------------------------------------------------------ */

function StelaRow({
  id,
  price,
  amount,
  deadline,
  source,
  side,
  mirrored,
  decimals,
  depthPct,
  interestAmount,
  interestSymbol,
  interestDecimals,
}: {
  id: string
  price: string
  amount: string
  deadline: number
  source: 'offchain' | 'onchain'
  side: 'bid' | 'ask'
  mirrored: boolean
  decimals: number
  depthPct: number
  interestAmount?: string
  interestSymbol?: string
  interestDecimals?: number
}) {
  const isBid = side === 'bid'
  const depthColor = isBid ? 'bg-emerald-500/10' : 'bg-rose-500/10'
  const priceColor = isBid ? 'text-emerald-500' : 'text-rose-500'
  const amountStr = formatTokenValue(amount, decimals)
  const expires = expiresIn(deadline)
  const isExpired = expires === 'exp'
  const href = source === 'onchain' ? `/stela/${id}` : `/order/${id}`

  return (
    <Link href={href} className="relative flex items-center h-[28px] px-2 transition-colors duration-75 cursor-pointer hover:bg-surface/40">
      {/* Depth bar */}
      <div
        className={cn('absolute inset-y-0 h-full pointer-events-none', depthColor)}
        style={{
          width: `${Math.min(depthPct, 100)}%`,
          ...(mirrored ? { right: 0 } : { left: 0 }),
        }}
      />

      <div className={cn('relative z-[1] flex items-center w-full gap-1', mirrored && 'flex-row-reverse')}>
        {/* Price / APR */}
        <span className={cn('font-mono text-[11px] tabular-nums shrink-0 w-[72px]', priceColor, mirrored ? 'text-right' : 'text-left')}>
          {price}
        </span>

        {/* Amount */}
        <span className={cn('font-mono text-[11px] tabular-nums text-chalk flex-1 truncate', mirrored ? 'text-left' : 'text-right')}>
          {amountStr}
          {interestAmount && interestSymbol && (
            <span className="text-[9px] text-aurora ml-1">
              {'\u2192'} {formatTokenValue(interestAmount, interestDecimals ?? decimals)} {interestSymbol}
            </span>
          )}
        </span>

        {/* Expires */}
        <span
          suppressHydrationWarning
          className={cn(
            'text-[9px] w-[52px] shrink-0 font-mono tabular-nums',
            mirrored ? 'text-left' : 'text-right',
            isExpired ? 'text-nova' : 'text-dust',
          )}
        >
          {expires}
        </span>

        {/* Source dot */}
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            source === 'onchain' ? 'bg-emerald-500/60' : 'bg-nebula/60',
          )}
          title={source === 'onchain' ? 'On-chain' : 'Off-chain'}
        />
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/*  Column header                                                      */
/* ------------------------------------------------------------------ */

function ColumnHeader({ mirrored, isLending }: { mirrored: boolean; isLending?: boolean }) {
  return (
    <div className={cn(
      'flex items-center h-6 px-2 text-[9px] text-ash uppercase tracking-widest border-b border-edge/10',
      mirrored && 'flex-row-reverse',
    )}>
      <span className={cn('w-[72px] shrink-0', mirrored ? 'text-right' : 'text-left')}>{isLending ? 'APR' : 'Rate'}</span>
      <span className={cn('flex-1', mirrored ? 'text-left' : 'text-right')}>Amount</span>
      <span className={cn('w-[52px] shrink-0', mirrored ? 'text-left' : 'text-right')}>Expires</span>
      <span className="w-1.5 shrink-0" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Flatten levels into individual stela rows                          */
/* ------------------------------------------------------------------ */

interface FlatRow {
  key: string
  price: string
  amount: string
  deadline: number
  source: 'offchain' | 'onchain'
  depthPct: number
  interestAmount?: string
  interestSymbol?: string
  interestDecimals?: number
}

function flattenLendingLevels(levels: LendingLevel[]): FlatRow[] {
  if (levels.length === 0) return []
  const maxCum = BigInt(levels[levels.length - 1]?.cumulative ?? '1')
  const rows: FlatRow[] = []
  let running = 0n
  for (const level of levels) {
    for (const o of level.orders) {
      running += BigInt(o.amount || '0')
      rows.push({
        key: o.id,
        price: `${level.apr.toFixed(1)}%`,
        amount: o.amount,
        deadline: o.deadline,
        source: o.source,
        depthPct: maxCum > 0n ? Number((running * 100n) / maxCum) : 0,
        interestAmount: o.interestAmount,
        interestSymbol: o.interestSymbol,
        interestDecimals: o.interestDecimals,
      })
    }
  }
  return rows
}

function flattenSwapLevels(levels: SwapLevel[]): FlatRow[] {
  if (levels.length === 0) return []
  const maxCum = BigInt(levels[levels.length - 1]?.cumulative ?? '1')
  const rows: FlatRow[] = []
  let running = 0n
  for (const level of levels) {
    for (const o of level.orders) {
      running += BigInt(o.amount || '0')
      rows.push({
        key: o.id,
        price: level.rate.toFixed(4),
        amount: o.amount,
        deadline: o.deadline,
        source: o.source,
        depthPct: maxCum > 0n ? Number((running * 100n) / maxCum) : 0,
      })
    }
  }
  return rows
}

/* ------------------------------------------------------------------ */
/*  Panel — one side of the split                                      */
/* ------------------------------------------------------------------ */

function BookPanel({
  title,
  subtitle,
  side,
  mirrored,
  rows,
  decimals,
  symbol,
  totalVolume,
  maxRows,
  isLending,
}: {
  title: string
  subtitle?: string
  side: 'bid' | 'ask'
  mirrored: boolean
  rows: FlatRow[]
  decimals: number
  symbol: string
  totalVolume: string
  maxRows: number
  isLending?: boolean
}) {
  const visible = rows.slice(0, maxRows)
  const sideColor = side === 'bid' ? 'text-emerald-500/80' : 'text-rose-500/80'

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between px-2 border-b border-edge/15" style={{ minHeight: subtitle ? 36 : 28 }}>
        <div className="flex flex-col">
          <span className={cn('text-[10px] font-medium uppercase tracking-widest', sideColor)}>
            {title}
          </span>
          {subtitle && (
            <span className="text-[8px] text-ash leading-tight">{subtitle}</span>
          )}
        </div>
        <span className="text-[9px] text-ash font-mono tabular-nums">
          {rows.length}
        </span>
      </div>
      <ColumnHeader mirrored={mirrored} isLending={isLending} />
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ maxHeight: `${maxRows * 28 + 4}px` }}>
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-14 text-[10px] text-ash">
            No orders
          </div>
        ) : (
          visible.map((row) => (
            <StelaRow
              key={row.key}
              id={row.key}
              price={row.price}
              amount={row.amount}
              deadline={row.deadline}
              source={row.source}
              side={side}
              mirrored={mirrored}
              decimals={decimals}
              depthPct={row.depthPct}
              interestAmount={row.interestAmount}
              interestSymbol={row.interestSymbol}
              interestDecimals={row.interestDecimals}
            />
          ))
        )}
      </div>
      {rows.length > maxRows && (
        <div className="flex items-center justify-center h-5 text-[9px] text-ash border-t border-edge/10">
          +{rows.length - maxRows} more
        </div>
      )}
      <div className="flex items-center justify-between h-6 px-2 border-t border-edge/10 text-[9px]">
        <span className="text-ash">Vol</span>
        <span className="text-chalk font-mono tabular-nums truncate ml-1">
          {formatTokenValue(totalVolume, decimals)} {symbol}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Lending: Borrow Base (left) | Borrow Quote (right)                 */
/* ------------------------------------------------------------------ */

function LendingSplit({
  pairData,
  reversePairData,
}: {
  pairData: OrderBookResponse
  reversePairData: OrderBookResponse | null
}) {
  const MAX_ROWS = 15

  const leftRows = useMemo(() => flattenLendingLevels(pairData.lending.asks), [pairData])
  const rightRows = useMemo(
    () => reversePairData ? flattenLendingLevels(reversePairData.lending.asks) : [],
    [reversePairData],
  )

  const baseSymbol = pairData.pair.base.symbol
  const quoteSymbol = pairData.pair.quote.symbol
  const baseDecimals = pairData.pair.base.decimals
  const quoteDecimals = pairData.pair.quote.decimals

  const isEmpty = leftRows.length === 0 && rightRows.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-dust">No borrow requests yet</p>
        <p className="text-[10px] text-ash mt-1">Post an order to start the market</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden md:flex w-full min-h-[180px]">
        <BookPanel
          title={`Borrow ${baseSymbol}`}
          subtitle={`Lend ${baseSymbol} to earn APR`}
          side="ask"
          mirrored={false}
          rows={leftRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.lending.totalAskVolume}
          maxRows={MAX_ROWS}
          isLending
        />
        <div className="w-px bg-edge/15 shrink-0" />
        <BookPanel
          title={`Borrow ${quoteSymbol}`}
          subtitle={`Lend ${quoteSymbol} to earn APR`}
          side="bid"
          mirrored
          rows={rightRows}
          decimals={quoteDecimals}
          symbol={quoteSymbol}
          totalVolume={reversePairData?.lending.totalAskVolume ?? '0'}
          maxRows={MAX_ROWS}
          isLending
        />
      </div>

      {/* Mobile: stacked */}
      <div className="flex flex-col md:hidden">
        <BookPanel
          title={`Borrow ${baseSymbol}`}
          subtitle={`Lend ${baseSymbol} to earn APR`}
          side="ask"
          mirrored={false}
          rows={leftRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.lending.totalAskVolume}
          maxRows={10}
          isLending
        />
        <div className="h-px bg-edge/15" />
        <BookPanel
          title={`Borrow ${quoteSymbol}`}
          subtitle={`Lend ${quoteSymbol} to earn APR`}
          side="bid"
          mirrored={false}
          rows={rightRows}
          decimals={quoteDecimals}
          symbol={quoteSymbol}
          totalVolume={reversePairData?.lending.totalAskVolume ?? '0'}
          maxRows={10}
          isLending
        />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Swap: Sell Base (left) | Buy Base (right)                          */
/* ------------------------------------------------------------------ */

function SwapSplit({ pairData }: { pairData: OrderBookResponse }) {
  const MAX_ROWS = 15

  const askRows = useMemo(() => {
    const sorted = [...pairData.swaps.asks].sort((a, b) => a.rate - b.rate)
    return flattenSwapLevels(sorted)
  }, [pairData])

  const bidRows = useMemo(() => {
    const sorted = [...pairData.swaps.bids].sort((a, b) => b.rate - a.rate)
    return flattenSwapLevels(sorted)
  }, [pairData])

  const baseSymbol = pairData.pair.base.symbol
  const quoteSymbol = pairData.pair.quote.symbol
  const baseDecimals = pairData.pair.base.decimals
  const bestBid = pairData.swaps.bids.length > 0 ? Math.max(...pairData.swaps.bids.map(b => b.rate)) : 0
  const bestAsk = pairData.swaps.asks.length > 0 ? Math.min(...pairData.swaps.asks.map(a => a.rate)) : 0

  const isEmpty = askRows.length === 0 && bidRows.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-dust">No swap orders yet</p>
        <p className="text-[10px] text-ash mt-1">Orders will appear when traders create swaps</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden md:flex w-full min-h-[180px]">
        <BookPanel
          title={`Sell ${baseSymbol}`}
          side="ask"
          mirrored={false}
          rows={askRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.swaps.totalAskVolume}
          maxRows={MAX_ROWS}
        />
        <div className="w-px bg-edge/15 shrink-0" />
        <BookPanel
          title={`Buy ${baseSymbol}`}
          side="bid"
          mirrored
          rows={bidRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.swaps.totalBidVolume}
          maxRows={MAX_ROWS}
        />
      </div>
      <div className="hidden md:block border-t border-edge/15">
        <SpreadRow bestAsk={bestAsk} bestBid={bestBid} symbol={quoteSymbol} />
      </div>

      {/* Mobile: stacked */}
      <div className="flex flex-col md:hidden">
        <BookPanel
          title={`Sell ${baseSymbol}`}
          side="ask"
          mirrored={false}
          rows={askRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.swaps.totalAskVolume}
          maxRows={10}
        />
        <SpreadRow bestAsk={bestAsk} bestBid={bestBid} symbol={quoteSymbol} />
        <BookPanel
          title={`Buy ${baseSymbol}`}
          side="bid"
          mirrored={false}
          rows={bidRows}
          decimals={baseDecimals}
          symbol={baseSymbol}
          totalVolume={pairData.swaps.totalBidVolume}
          maxRows={10}
        />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Main SplitBook                                                     */
/* ------------------------------------------------------------------ */

export function SplitBook({ pairData, reversePairData, isLoading, mode }: SplitBookProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-edge/30 bg-abyss overflow-hidden">
        <div className="flex items-center justify-center h-8 border-b border-edge/20">
          <span className="text-xs font-display uppercase tracking-wider text-chalk">Order Book</span>
        </div>
        <BookSkeleton />
      </div>
    )
  }

  if (!pairData) {
    return (
      <div className="rounded-xl border border-edge/30 bg-abyss overflow-hidden">
        <div className="flex items-center justify-center h-8 border-b border-edge/20">
          <span className="text-xs font-display uppercase tracking-wider text-chalk">Order Book</span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash mb-3">
            <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
          <p className="text-sm text-dust">No orders for this pair yet</p>
          <p className="text-[10px] text-ash mt-1">Be the first to create an order</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-edge/30 bg-abyss overflow-hidden">
      <div className="flex items-center justify-center h-8 border-b border-edge/20">
        <span className="text-xs font-display uppercase tracking-wider text-chalk">Order Book</span>
      </div>

      {mode === 'lending' ? (
        <LendingSplit pairData={pairData} reversePairData={reversePairData} />
      ) : (
        <SwapSplit pairData={pairData} />
      )}
    </div>
  )
}
