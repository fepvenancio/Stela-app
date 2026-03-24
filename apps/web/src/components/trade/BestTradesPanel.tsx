'use client'

import { useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import { computeYieldPercent, type FilterableAsset } from '@/lib/filter-utils'
import { computeInterestRate } from '@stela/core'
import { BlendedRateSummary } from './BlendedRateSummary'
import { BotRankBadge } from './BotRankBadge'
import { formatAddress } from '@/lib/address'
import { formatTokenValue, formatDuration } from '@/lib/format'

/* ── Types ──────────────────────────────────────────────────────────── */

export type BestTradesMode = 'lending' | 'swap'

export interface BestTradesPanelProps {
  offchainMatches: MatchedOrder[]
  onchainMatches: OnChainMatch[]
  /** True while the match detection network requests are in-flight */
  isChecking: boolean
  /** 'lending' shows APR ranking; 'swap' shows rate ranking */
  mode: BestTradesMode
  /** Called when user clicks Fill on a row */
  onFill: (order: MatchedOrder | OnChainMatch, source: 'offchain' | 'onchain') => void
  /** Disable Fill buttons while a settlement is pending */
  isSettling?: boolean
}

/* ── Internal representation ────────────────────────────────────────── */

interface RankedTrade {
  id: string
  source: 'offchain' | 'onchain'
  counterparty: string
  debtAssets: FilterableAsset[]
  interestAssets: FilterableAsset[]
  collateralAssets: FilterableAsset[]
  duration: number
  deadline: number
  /** APR % for lending mode; collateral-per-debt-unit for swap mode. null if not computable. */
  score: number | null
  /** Bot settlement priority (1 = lowest rate = settled first). null for swap mode. */
  botRank: number | null
  raw: MatchedOrder | OnChainMatch
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function toFilterable(
  assets: Array<{ asset_address: string; asset_type: string; value?: string | null }>,
): FilterableAsset[] {
  return assets.map((a) => ({
    asset_address: a.asset_address,
    asset_type: a.asset_type,
    value: a.value ?? null,
  }))
}

function sumRawAssets(assets: FilterableAsset[]): bigint {
  let total = 0n
  for (const a of assets) {
    if (a.asset_type === 'ERC721') continue
    try {
      total += BigInt(a.value ?? '0')
    } catch {
      // skip malformed values
    }
  }
  return total
}

/**
 * Swap rate: units of collateral received per unit of debt given.
 * Higher is better for the lender filling the order.
 */
function computeSwapRate(
  debtAssets: FilterableAsset[],
  collateralAssets: FilterableAsset[],
): number | null {
  const debtTotal = sumRawAssets(debtAssets)
  const collTotal = sumRawAssets(collateralAssets)
  if (debtTotal === 0n) return null
  // Scale to avoid bigint precision loss: multiply by 1e6 then divide back
  return Number((collTotal * 1_000_000n) / debtTotal) / 1_000_000
}

function normalizeOffchain(match: MatchedOrder): RankedTrade {
  const d = match.order_data
  // order_data may use camelCase or snake_case keys depending on how it was stored
  const rawDebt = ((d.debtAssets ?? d.debt_assets ?? []) as Array<{
    asset_address: string
    asset_type: string
    value?: string
  }>)
  const rawInterest = ((d.interestAssets ?? d.interest_assets ?? []) as Array<{
    asset_address: string
    asset_type: string
    value?: string
  }>)
  const rawCollateral = ((d.collateralAssets ?? d.collateral_assets ?? []) as Array<{
    asset_address: string
    asset_type: string
    value?: string
  }>)

  return {
    id: match.id,
    source: 'offchain',
    counterparty: match.borrower,
    debtAssets: toFilterable(rawDebt),
    interestAssets: toFilterable(rawInterest),
    collateralAssets: toFilterable(rawCollateral),
    duration: Number((d.duration as string | number) ?? 0),
    deadline: match.deadline,
    score: null, // computed during ranking
    botRank: null,
    raw: match,
  }
}

function normalizeOnchain(match: OnChainMatch): RankedTrade {
  return {
    id: match.id,
    source: 'onchain',
    counterparty: match.borrower,
    debtAssets: toFilterable(match.debtAssets ?? []),
    interestAssets: toFilterable(match.interestAssets ?? []),
    collateralAssets: toFilterable(match.collateralAssets ?? []),
    duration: match.duration,
    deadline: match.deadline,
    score: null,
    botRank: null,
    raw: match,
  }
}

/* ── Source badge ────────────────────────────────────────────────────── */

function SourceBadge({ source }: { source: 'offchain' | 'onchain' }) {
  const classes =
    source === 'onchain'
      ? 'bg-accent/15 text-accent'
      : 'bg-green-500/15 text-green-500'
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${classes}`}
    >
      {source === 'onchain' ? 'On-chain' : 'Off-chain'}
    </span>
  )
}

/* ── Single trade row ────────────────────────────────────────────────── */

function TradeRow({
  trade,
  mode,
  onFill,
  isSettling,
}: {
  trade: RankedTrade
  mode: BestTradesMode
  onFill: () => void
  isSettling: boolean
}) {
  // Primary debt asset for amount display
  const debtToken = trade.debtAssets[0]
    ? findTokenByAddress(trade.debtAssets[0].asset_address)
    : null
  const debtAmount = trade.debtAssets[0]
    ? formatTokenValue(trade.debtAssets[0].value ?? '0', debtToken?.decimals ?? 18)
    : '–'
  const debtSymbol = debtToken?.symbol ?? '???'

  // Score display
  const scoreLabel =
    trade.score === null
      ? '–'
      : mode === 'swap'
        ? trade.score.toFixed(4)
        : `${trade.score.toFixed(2)}%`
  const scoreTitle = mode === 'swap' ? 'Rate' : 'APR'

  // Duration and expiry
  const durationLabel = trade.duration > 0 ? formatDuration(trade.duration) : 'Instant'
  const nowSec = Math.floor(Date.now() / 1000)
  const secsLeft = trade.deadline - nowSec
  const isExpired = secsLeft <= 0
  const expiryLabel = isExpired ? 'Expired' : `${formatDuration(secsLeft)} left`

  return (
    <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center px-3 py-2.5 border-b border-border/20 last:border-b-0 hover:bg-surface/20 transition-colors">
      {/* Counterparty + source badge + bot rank (col 3) */}
      <div className="col-span-3 flex flex-col gap-1 min-w-0">
        <span className="text-white font-mono text-xs truncate">
          {formatAddress(trade.counterparty)}
        </span>
        <div className="flex items-center gap-1.5">
          <SourceBadge source={trade.source} />
          {trade.botRank !== null && <BotRankBadge rank={trade.botRank} />}
        </div>
      </div>

      {/* Amount (col 3) */}
      <div className="col-span-3 flex flex-col gap-0.5 min-w-0">
        <span className="text-white font-medium text-xs truncate">{debtAmount}</span>
        <span className="text-gray-400 text-[10px]">{debtSymbol}</span>
      </div>

      {/* APR / Rate — hidden on mobile (col 2) */}
      <div className="hidden sm:flex col-span-2 flex-col gap-0.5">
        <span className="text-sky-400 font-semibold text-xs">{scoreLabel}</span>
        <span className="text-gray-400 text-[10px]">{scoreTitle}</span>
      </div>

      {/* Duration / Expiry — hidden on mobile (col 2) */}
      <div className="hidden sm:flex col-span-2 flex-col gap-0.5">
        <span className="text-white text-xs">{durationLabel}</span>
        <span className={`text-[10px] ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
          {expiryLabel}
        </span>
      </div>

      {/* Fill action (col 6 mobile → col 2 desktop, right-aligned) */}
      <div className="col-span-6 sm:col-span-2 flex justify-end">
        <button
          type="button"
          onClick={onFill}
          disabled={isSettling || isExpired}
          className="h-8 px-3 sm:px-4 bg-accent/10 hover:bg-accent/20 active:bg-accent/30 text-accent border border-accent/30 hover:border-accent/50 font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs whitespace-nowrap flex items-center justify-center gap-1.5"
          aria-label={`Fill order from ${formatAddress(trade.counterparty)}`}
        >
          {isSettling ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            'Fill'
          )}
        </button>
      </div>
    </div>
  )
}

/* ── Loading skeleton row ────────────────────────────────────────────── */

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      className="grid grid-cols-12 gap-2 sm:gap-3 items-center px-3 py-2.5 border-b border-border/20 last:border-b-0 animate-pulse"
      aria-hidden="true"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="col-span-3 flex flex-col gap-1">
        <div className="h-3 w-20 bg-surface/60 rounded" />
        <div className="h-3 w-14 bg-surface/40 rounded" />
      </div>
      <div className="col-span-3 flex flex-col gap-1">
        <div className="h-3 w-16 bg-surface/60 rounded" />
        <div className="h-3 w-10 bg-surface/40 rounded" />
      </div>
      <div className="hidden sm:flex col-span-2 flex-col gap-1">
        <div className="h-3 w-12 bg-surface/60 rounded" />
        <div className="h-3 w-8 bg-surface/40 rounded" />
      </div>
      <div className="hidden sm:flex col-span-2 flex-col gap-1">
        <div className="h-3 w-10 bg-surface/60 rounded" />
        <div className="h-3 w-14 bg-surface/40 rounded" />
      </div>
      <div className="col-span-6 sm:col-span-2 flex justify-end">
        <div className="h-8 w-14 bg-surface/40 rounded-lg" />
      </div>
    </div>
  )
}

/* ── Panel ───────────────────────────────────────────────────────────── */

const MAX_ROWS = 5

export function BestTradesPanel({
  offchainMatches,
  onchainMatches,
  isChecking,
  mode,
  onFill,
  isSettling = false,
}: BestTradesPanelProps) {
  // Track whether we've ever completed a check so we don't flash empty state
  // immediately before the first check begins.
  const hasCompletedCheckRef = useRef(false)
  if (!isChecking && (offchainMatches.length > 0 || onchainMatches.length > 0)) {
    hasCompletedCheckRef.current = true
  }
  // Mark as checked once isChecking transitions to false after having been true.
  // We track "was checking" via the previous render's isChecking value.
  const wasCheckingRef = useRef(false)
  if (isChecking) wasCheckingRef.current = true
  if (!isChecking && wasCheckingRef.current) {
    hasCompletedCheckRef.current = true
  }

  const ranked = useMemo((): RankedTrade[] => {
    const all: RankedTrade[] = [
      ...offchainMatches.map(normalizeOffchain),
      ...onchainMatches.map(normalizeOnchain),
    ]

    // Compute score for each trade
    for (const trade of all) {
      if (mode === 'swap') {
        trade.score = computeSwapRate(trade.debtAssets, trade.collateralAssets)
      } else {
        // lending mode: yield % (interest / debt * 100)
        trade.score = computeYieldPercent(trade.debtAssets, trade.interestAssets)
      }
    }

    // Sort: higher score = better for both lend (APR) and swap (rate received)
    all.sort((a, b) => {
      if (a.score === null && b.score === null) return 0
      if (a.score === null) return 1
      if (b.score === null) return -1
      return b.score - a.score
    })

    // Compute bot settlement rank (ascending by interest rate — lowest first)
    // Only meaningful in lending mode (swaps don't go through bot settlement)
    if (mode === 'lending') {
      const rateEntries = all.map((trade, idx) => {
        const rate = computeInterestRate(
          trade.debtAssets.map(a => ({ asset_type: a.asset_type, value: a.value ?? '0' })),
          trade.interestAssets.map(a => ({ asset_type: a.asset_type, value: a.value ?? '0' })),
        )
        return { idx, rate }
      })

      // Sort ascending by rate (lowest first = bot settles first), nulls last
      rateEntries.sort((a, b) => {
        if (a.rate === null && b.rate === null) return 0
        if (a.rate === null) return 1
        if (b.rate === null) return -1
        return a.rate - b.rate
      })

      for (let rank = 0; rank < rateEntries.length; rank++) {
        all[rateEntries[rank].idx].botRank = rank + 1
      }
    } else {
      for (const trade of all) trade.botRank = null
    }

    return all.slice(0, MAX_ROWS)
  }, [offchainMatches, onchainMatches, mode])

  const blendedEntries = ranked.map(t => ({
    apr: t.score,
    debtAmount: sumRawAssets(t.debtAssets),
  }))

  const isLoading = isChecking && ranked.length === 0
  const isEmpty = !isChecking && ranked.length === 0 && hasCompletedCheckRef.current

  // Show stale results with a loading indicator while re-checking
  const showStaleResults = isChecking && ranked.length > 0
  const showResults = !isChecking && ranked.length > 0

  const sectionLabel = mode === 'swap' ? 'Best Rates' : 'Best Deals'

  return (
    <section aria-label="Best available trades" className="space-y-3">
      <BlendedRateSummary entries={blendedEntries} mode={mode} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-accent font-mono text-xs uppercase tracking-[0.3em]">
            {sectionLabel}
          </span>
          {(showResults || showStaleResults) && (
            <span className="text-[10px] text-gray-400">
              {ranked.length} match{ranked.length !== 1 ? 'es' : ''}
            </span>
          )}
          {mode === 'lending' && (showResults || showStaleResults) && (
            <span
              className="text-[9px] text-gray-400/60 cursor-help"
              title="The bot settles offers with the lowest interest rate first. Rank #1 = cheapest for borrower = settled first."
            >
              (bot-ranked)
            </span>
          )}
        </div>

        {isChecking && (
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Scanning…
          </span>
        )}
      </div>

      {/* Body */}
      <div className="rounded-lg border border-border/30 overflow-clip">
        {/* ── Loading skeleton (first check, no stale data) ── */}
        {isLoading && (
          <div className="flex flex-col" role="status" aria-label="Searching for best trades">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} index={i} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="px-4 py-8 text-center space-y-2">
            <p className="text-gray-400 text-sm">No orders found — create one</p>
            <p className="text-[10px] text-gray-500">
              {mode === 'swap'
                ? 'Be the first to post a swap order for this pair'
                : 'Be the first to post a lending order for this pair'}
            </p>
          </div>
        )}

        {/* ── Results (with optional stale-refresh indicator) ── */}
        {(showResults || showStaleResults) && (
          <>
            {/* Column header — desktop only */}
            <div
              className="hidden sm:grid grid-cols-12 gap-3 px-3 py-1.5 text-[9px] text-gray-400 uppercase tracking-widest font-semibold border-b border-border/40 bg-[#050505]/95 sticky top-0 z-10"
              aria-hidden="true"
            >
              <div className="col-span-3">Counterparty</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-2">{mode === 'swap' ? 'Rate' : 'APR'}</div>
              <div className="col-span-2">Duration / Expiry</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Trade rows */}
            <div
              className={showStaleResults ? 'opacity-60 pointer-events-none' : undefined}
              aria-busy={showStaleResults}
            >
              {ranked.map((trade) => (
                <TradeRow
                  key={`${trade.source}-${trade.id}`}
                  trade={trade}
                  mode={mode}
                  onFill={() => onFill(trade.raw, trade.source)}
                  isSettling={isSettling}
                />
              ))}
            </div>

            {/* Footer hint when showing max rows */}
            {ranked.length >= MAX_ROWS && (
              <div className="px-3 py-2 border-t border-border/20 bg-surface/5 text-center">
                <span className="text-[10px] text-gray-400">
                  Showing top {MAX_ROWS} by {mode === 'swap' ? 'rate' : 'APR'}{mode === 'lending' ? ' — ranked by bot settlement priority' : ''}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
