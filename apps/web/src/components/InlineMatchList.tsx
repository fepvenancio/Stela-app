'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { OffchainMatchListRow, OnchainMatchListRow } from '@/components/MatchListRow'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import type { SelectedOrders } from '@/lib/multi-match'

/* ── Types ──────────────────────────────────────────────── */

interface InlineMatchListProps {
  offchainMatches: MatchedOrder[]
  onchainMatches: OnChainMatch[]
  isSwap: boolean
  onSettleOffchain: (match: MatchedOrder) => void
  onSettleOnchain: (match: OnChainMatch) => void
  onSettleMultiple?: () => void
  onSkip: () => void
  isSettling: boolean
  multiSettleSelection?: SelectedOrders | null
  /** Symbol of the token the user gives (their collateral = matched orders' debt) */
  giveSymbol?: string
  /** Symbol of the token the user receives (their debt = matched orders' collateral) */
  receiveSymbol?: string
}

/* ── Multi-Settle Summary ───────────────────────────────── */

function MultiSettleSummary({
  selection,
  giveSymbol,
  receiveSymbol,
  onSettle,
  isSettling,
}: {
  selection: SelectedOrders
  giveSymbol: string
  receiveSymbol: string
  onSettle: () => void
  isSettling: boolean
}) {
  const count = selection.selected.length

  const firstDebtToken = useMemo(() => {
    for (const s of selection.selected) {
      if (s.type === 'offchain') {
        const d = s.order.order_data
        const assets = (d.debtAssets ?? d.debt_assets) as Record<string, string>[] | undefined
        if (assets?.[0]) return findTokenByAddress(assets[0].asset_address)
      } else {
        if (s.match.debtAssets?.[0]) return findTokenByAddress(s.match.debtAssets[0].asset_address)
      }
    }
    return null
  }, [selection.selected])

  const firstCollateralToken = useMemo(() => {
    for (const s of selection.selected) {
      if (s.type === 'offchain') {
        const d = s.order.order_data
        const assets = (d.collateralAssets ?? d.collateral_assets) as Record<string, string>[] | undefined
        if (assets?.[0]) return findTokenByAddress(assets[0].asset_address)
      } else {
        if (s.match.collateralAssets?.[0]) return findTokenByAddress(s.match.collateralAssets[0].asset_address)
      }
    }
    return null
  }, [selection.selected])

  const giveFormatted = formatTokenValue(selection.totalGive.toString(), firstDebtToken?.decimals ?? 18)
  const receiveFormatted = formatTokenValue(selection.totalReceive.toString(), firstCollateralToken?.decimals ?? 18)

  const { onchainCount, offchainCount } = selection
  const breakdownText = onchainCount > 0 && offchainCount > 0
    ? `${onchainCount} on-chain + ${offchainCount} off-chain`
    : `${count} orders`

  return (
    <div className="px-3 py-3 border-b border-edge/20 bg-star/5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-dust">You give:</span>
            <span className="text-chalk font-medium">
              {giveFormatted} <span className="text-dust">{giveSymbol}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-dust">You get:</span>
            <span className="text-chalk font-medium">
              {receiveFormatted} <span className="text-dust">{receiveSymbol}</span>
            </span>
          </div>
          <div className="text-[10px] text-dust">
            {breakdownText}
            {selection.coverage < 100 && ` — covers ${selection.coverage}% of desired amount`}
          </div>
        </div>

        <button
          type="button"
          onClick={onSettle}
          disabled={isSettling}
          className="h-9 px-5 bg-star hover:bg-star-bright text-void font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm shrink-0"
        >
          {isSettling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Settling...
            </>
          ) : selection.coverage >= 100 ? (
            `Swap All ${count}`
          ) : (
            `Swap ${selection.coverage}%`
          )}
        </button>
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */

export function InlineMatchList({
  offchainMatches,
  onchainMatches,
  isSwap,
  onSettleOffchain,
  onSettleOnchain,
  onSettleMultiple,
  onSkip,
  isSettling,
  multiSettleSelection,
  giveSymbol,
  receiveSymbol,
}: InlineMatchListProps) {
  const totalMatches = offchainMatches.length + onchainMatches.length
  if (totalMatches === 0) return null

  const showMultiSettle = isSwap
    && multiSettleSelection
    && multiSettleSelection.selected.length > 1
    && onSettleMultiple

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-star font-mono text-xs uppercase tracking-[0.3em]">
            {isSwap
              ? multiSettleSelection && multiSettleSelection.coverage >= 100
                ? 'Fully Matched'
                : multiSettleSelection && multiSettleSelection.coverage > 0
                  ? `${multiSettleSelection.coverage}% Matched`
                  : 'Matches Found'
              : 'Compatible Orders'}
          </span>
          <span className="text-[10px] text-dust">
            {totalMatches} order{totalMatches !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          disabled={isSettling}
          className="text-[11px] text-dust hover:text-chalk transition-colors cursor-pointer disabled:opacity-40"
        >
          Skip
        </button>
      </div>

      {/* Table container — same style as browse page */}
      <div className="rounded-lg border border-edge/30 overflow-clip">
        {/* Aggregate summary for multi-settle — stays visible above scroll */}
        {showMultiSettle && (
          <MultiSettleSummary
            selection={multiSettleSelection}
            giveSymbol={giveSymbol ?? '???'}
            receiveSymbol={receiveSymbol ?? '???'}
            onSettle={onSettleMultiple}
            isSettling={isSettling}
          />
        )}

        {/* Table header — sticky within scroll container */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[9px] text-dust uppercase tracking-widest font-semibold border-b border-edge/40 bg-void/95 sticky top-0 z-10">
          <div className="grid grid-cols-12 gap-3 flex-1">
            <div className="col-span-2">Type</div>
            <div className="col-span-3">They Borrow</div>
            <div className="col-span-2">Interest</div>
            <div className="col-span-3">Collateral</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
        </div>

        {/* Match rows — scrollable, generous height for many matches */}
        <div className="flex flex-col max-h-[50vh] overflow-y-auto">
          {offchainMatches.map((match) => (
            <OffchainMatchListRow
              key={match.id}
              match={match}
              isSwap={isSwap}
              onSettle={() => onSettleOffchain(match)}
              isSettling={isSettling}
            />
          ))}
          {onchainMatches.map((match) => (
            <OnchainMatchListRow
              key={match.id}
              match={match}
              isSwap={isSwap}
              onSettle={() => onSettleOnchain(match)}
              isSettling={isSettling}
            />
          ))}
        </div>

        {/* Footer with count when many matches */}
        {totalMatches > 3 && (
          <div className="px-3 py-2 border-t border-edge/20 bg-surface/5 text-center">
            <span className="text-[10px] text-dust">
              Showing {totalMatches} {isSwap ? 'swap' : 'order'}{totalMatches !== 1 ? 's' : ''} — scroll to see all
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
