'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { formatAddress } from '@/lib/address'
import { formatDuration, formatTimestamp } from '@/lib/format'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'

/* ── Types ──────────────────────────────────────────────── */

interface InlineMatchListProps {
  offchainMatches: MatchedOrder[]
  onchainMatches: OnChainMatch[]
  isSwap: boolean
  onSettleOffchain: (match: MatchedOrder) => void
  onSettleOnchain: (match: OnChainMatch) => void
  onSkip: () => void
  isSettling: boolean
}

interface AssetDisplay {
  address: string
  type: string
  value: string
  tokenId: string
  symbol: string
  decimals: number
  formatted: string
}

/* ── Helpers ────────────────────────────────────────────── */

function parseAssets(raw: unknown): AssetDisplay[] {
  if (!Array.isArray(raw)) return []
  return raw.map((a: Record<string, string>) => {
    const token = findTokenByAddress(a.asset_address)
    const decimals = token?.decimals ?? 18
    const isNft = a.asset_type === 'ERC721' || a.asset_type === 'ERC1155'
    return {
      address: a.asset_address,
      type: a.asset_type,
      value: a.value || '0',
      tokenId: a.token_id || '0',
      symbol: token?.symbol ?? formatAddress(a.asset_address),
      decimals,
      formatted: isNft ? `#${a.token_id}` : formatTokenValue(a.value || '0', decimals),
    }
  })
}

/* ── Asset Summary Line ─────────────────────────────────── */

function AssetSummary({ label, assets, labelClass }: { label: string; assets: AssetDisplay[]; labelClass: string }) {
  if (assets.length === 0) return null
  return (
    <div>
      <span className={`text-[9px] uppercase tracking-widest font-bold ${labelClass}`}>{label}</span>
      <div className="mt-1 space-y-1">
        {assets.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <TokenAvatarByAddress address={a.address} size={16} />
            <span className="text-sm text-chalk font-medium">
              {a.formatted} <span className="text-dust">{a.symbol}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Off-Chain Match Card ───────────────────────────────── */

function OffchainMatchCard({
  match,
  isSwap,
  onSettle,
  isSettling,
}: {
  match: MatchedOrder
  isSwap: boolean
  onSettle: () => void
  isSettling: boolean
}) {
  const orderData = match.order_data
  const debtAssets = useMemo(
    () => parseAssets(orderData.debtAssets ?? orderData.debt_assets),
    [orderData],
  )
  const collateralAssets = useMemo(
    () => parseAssets(orderData.collateralAssets ?? orderData.collateral_assets),
    [orderData],
  )
  const interestAssets = useMemo(
    () => parseAssets(orderData.interestAssets ?? orderData.interest_assets),
    [orderData],
  )

  const duration = Number(orderData.duration ?? '0')
  const deadline = Number(orderData.deadline ?? match.deadline ?? '0')
  const secondsLeft = deadline - Math.floor(Date.now() / 1000)

  const ctaText = isSwap ? 'Swap Now & Earn 5 BPS' : 'Settle Now & Earn 5 BPS'

  return (
    <div className="bg-abyss/60 border border-edge/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/20">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-surface/20 text-dust border border-edge/20">
            Off-chain
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
            isSwap ? 'bg-aurora/10 text-aurora' : 'bg-nebula/10 text-nebula'
          }`}>
            {isSwap ? 'Swap' : 'Loan'}
          </span>
          <span className="text-[10px] text-dust font-mono">{formatAddress(match.borrower)}</span>
        </div>
        {secondsLeft > 0 && (
          <span className="text-[10px] text-dust">
            expires {formatTimestamp(BigInt(deadline))}
          </span>
        )}
      </div>

      {/* Assets */}
      <div className="px-4 py-3 space-y-2">
        <AssetSummary label="They borrow (you lend)" assets={debtAssets} labelClass="text-dust" />
        <AssetSummary label="Their collateral" assets={collateralAssets} labelClass="text-star" />
        {interestAssets.length > 0 && (
          <AssetSummary label="Interest you earn" assets={interestAssets} labelClass="text-aurora" />
        )}
        {!isSwap && duration > 0 && (
          <div className="flex items-center gap-4 text-[11px] text-dust pt-1">
            <span>Duration: <span className="text-chalk">{formatDuration(duration)}</span></span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onSettle}
          disabled={isSettling}
          className="w-full h-10 bg-star hover:bg-star-bright text-void font-semibold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
        >
          {isSettling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Settling...
            </>
          ) : (
            ctaText
          )}
        </button>
      </div>
    </div>
  )
}

/* ── On-Chain Match Card ────────────────────────────────── */

function OnchainMatchCard({
  match,
  isSwap,
  onSettle,
  isSettling,
}: {
  match: OnChainMatch
  isSwap: boolean
  onSettle: () => void
  isSettling: boolean
}) {
  const debtAssets = useMemo(() => parseAssets(match.debtAssets), [match.debtAssets])
  const collateralAssets = useMemo(() => parseAssets(match.collateralAssets), [match.collateralAssets])
  const interestAssets = useMemo(() => parseAssets(match.interestAssets), [match.interestAssets])

  const duration = Number(match.duration ?? '0')
  const deadline = Number(match.deadline ?? '0')
  const secondsLeft = deadline - Math.floor(Date.now() / 1000)

  const ctaText = isSwap ? 'Swap Now' : 'Lend Now'

  return (
    <div className="bg-abyss/60 border border-star/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/20">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-star/10 text-star border border-star/25">
            On-chain
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
            isSwap ? 'bg-aurora/10 text-aurora' : 'bg-nebula/10 text-nebula'
          }`}>
            {isSwap ? 'Swap' : 'Loan'}
          </span>
          <span className="text-[10px] text-dust font-mono">{formatAddress(match.borrower)}</span>
        </div>
        {secondsLeft > 0 && (
          <span className="text-[10px] text-dust">
            expires {formatTimestamp(BigInt(deadline))}
          </span>
        )}
      </div>

      {/* Assets */}
      <div className="px-4 py-3 space-y-2">
        <AssetSummary label="They borrow (you lend)" assets={debtAssets} labelClass="text-dust" />
        <AssetSummary label="Their collateral" assets={collateralAssets} labelClass="text-star" />
        {interestAssets.length > 0 && (
          <AssetSummary label="Interest you earn" assets={interestAssets} labelClass="text-aurora" />
        )}
        {!isSwap && duration > 0 && (
          <div className="flex items-center gap-4 text-[11px] text-dust pt-1">
            <span>Duration: <span className="text-chalk">{formatDuration(duration)}</span></span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onSettle}
          disabled={isSettling}
          className="w-full h-10 bg-star hover:bg-star-bright text-void font-semibold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
        >
          {isSettling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            ctaText
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
  onSkip,
  isSettling,
}: InlineMatchListProps) {
  const totalMatches = offchainMatches.length + onchainMatches.length
  if (totalMatches === 0) return null

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-star font-mono text-xs uppercase tracking-[0.3em]">
          {isSwap ? 'Instant Swap Available' : 'Compatible Orders Found'}
        </span>
        <span className="text-[10px] text-dust">
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
        </span>
      </div>

      {isSwap && (
        <p className="text-[11px] text-dust -mt-1">
          Swaps settle instantly with 0.10% fee
        </p>
      )}

      {/* Match cards */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {offchainMatches.map((match) => (
          <OffchainMatchCard
            key={match.id}
            match={match}
            isSwap={isSwap}
            onSettle={() => onSettleOffchain(match)}
            isSettling={isSettling}
          />
        ))}
        {onchainMatches.map((match) => (
          <OnchainMatchCard
            key={match.id}
            match={match}
            isSwap={isSwap}
            onSettle={() => onSettleOnchain(match)}
            isSettling={isSettling}
          />
        ))}
      </div>

      {/* Skip link */}
      <button
        type="button"
        onClick={onSkip}
        disabled={isSettling}
        className="w-full text-center text-dust hover:text-chalk text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed py-1"
      >
        Skip — Create my own order instead
      </button>
    </section>
  )
}
