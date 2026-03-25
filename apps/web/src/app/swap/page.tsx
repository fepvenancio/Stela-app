'use client'

import { useState, useCallback } from 'react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { useOrderForm } from '@/hooks/useOrderForm'
import { useFeePreview } from '@/hooks/useFeePreview'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { BestTradesPanel } from '@/components/trade/BestTradesPanel'
import { TokenBox } from '@/components/trade/TokenBox'
import { Spinner } from '@/components/trade/Spinner'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { formatTokenValue } from '@/lib/format'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import {
  SWAP_DEADLINE_PRESETS,
  emptyAsset,
} from '@/lib/trade-constants'

/* ── Direction Arrow ─────────────────────────────────────── */

function DirectionArrow({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex justify-center -my-2 relative z-10">
      <button
        type="button"
        onClick={onClick}
        className="w-8 h-8 bg-surface border border-border/50 rounded-md flex items-center justify-center hover:border-accent/50 transition-colors cursor-pointer"
        aria-label="Swap direction"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
          <path d="M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3" />
        </svg>
      </button>
    </div>
  )
}

/* ── Swap Page ───────────────────────────────────────────── */

export default function SwapPage() {
  const form = useOrderForm('swap')
  const feePreview = useFeePreview('swap')
  const [openSelector, setOpenSelector] = useState<'give' | 'receive' | null>(null)

  const giveAsset = form.collateralAssets[0] ?? emptyAsset()
  const receiveAsset = form.debtAssets[0] ?? emptyAsset()

  const giveToken = giveAsset.asset ? findTokenByAddress(giveAsset.asset) : null
  const giveBalance = giveAsset.asset ? form.balances.get(giveAsset.asset.toLowerCase()) : undefined
  const receiveBalance = receiveAsset.asset ? form.balances.get(receiveAsset.asset.toLowerCase()) : undefined

  /* ── Token selection handlers ──── */

  const handleTokenSelect = useCallback((slot: 'give' | 'receive', token: TokenInfo) => {
    const addr = token.addresses[NETWORK] ?? ''
    const newAsset: AssetInputValue = {
      asset: addr,
      asset_type: 'ERC20',
      value: '',
      token_id: '0',
      decimals: token.decimals,
    }
    if (slot === 'give') form.setCollateralAssets([newAsset])
    else form.setDebtAssets([newAsset])
    setOpenSelector(null)
  }, [form])

  const handleAmountChange = useCallback((slot: 'give' | 'receive', val: string) => {
    if (slot === 'give') {
      const current = form.collateralAssets[0] ?? emptyAsset()
      form.setCollateralAssets([{ ...current, value: val }])
    } else {
      const current = form.debtAssets[0] ?? emptyAsset()
      form.setDebtAssets([{ ...current, value: val }])
    }
  }, [form])

  const handleSwapDirection = useCallback(() => {
    const oldGive = form.collateralAssets
    const oldReceive = form.debtAssets
    form.setCollateralAssets(oldReceive)
    form.setDebtAssets(oldGive)
  }, [form])

  const handleMaxClick = useCallback(() => {
    if (giveToken && giveBalance) {
      const formatted = formatTokenValue(giveBalance.toString(), giveToken.decimals)
      const current = form.collateralAssets[0] ?? emptyAsset()
      form.setCollateralAssets([{ ...current, value: formatted }])
    }
  }, [form, giveToken, giveBalance])

  /* ── Match state analysis ──── */

  const hasTokens = form.hasDebt && form.hasCollateral
  const showMatches = form.matchesVisible && form.hasMatches
  const totalMatches = showMatches ? form.offchainMatches.length + form.onchainMatches.length : 0
  const sel = form.multiSettleSelection
  const coverage = sel?.coverage ?? 0
  const hasFullMatch = showMatches && sel != null && coverage >= 100
  const hasPartialMatch = showMatches && sel != null && coverage > 0 && coverage < 100
  const isProcessing = form.isPending || form.isCreatingOnChain || form.isSettling || form.isSettlingOnChain || form.multiSettleState.phase !== 'idle'

  const feeText = (feePreview.effectiveTotalBps / 100).toFixed(2) + '%'

  const handleFill = useCallback((_order: MatchedOrder | OnChainMatch, _source: 'offchain' | 'onchain') => {
    // BestTradesPanel fill — handled via main submit flow
  }, [])

  return (
    <div className="max-w-md mx-auto space-y-5 pt-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full border border-accent/20">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3" />
          </svg>
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">P2P Swap</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Instant Swap</h1>
        <p className="text-gray-500 text-xs leading-relaxed">
          Swap assets peer-to-peer using the Stela protocol. No duration, no collateral lock.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />

        {/* Sell (give) box */}
        <TokenBox
          label="I Give"
          accentClass="text-accent"
          borderClass="border-accent/20"
          bgClass="bg-accent/5"
          asset={giveAsset}
          balance={giveBalance}
          onTokenClick={() => setOpenSelector('give')}
          onAmountChange={(val) => handleAmountChange('give', val)}
          onMaxClick={handleMaxClick}
        />

        {/* Direction arrow */}
        <DirectionArrow onClick={handleSwapDirection} />

        {/* Buy (receive) box */}
        <TokenBox
          label="I Receive"
          accentClass="text-green-500"
          borderClass="border-green-500/20"
          bgClass="bg-green-500/5"
          asset={receiveAsset}
          balance={receiveBalance}
          onTokenClick={() => setOpenSelector('receive')}
          onAmountChange={(val) => handleAmountChange('receive', val)}
        />

        {/* Validation Errors */}
        {form.showErrors && (!form.hasDebt || !form.hasCollateral) && (
          <div className="px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5">
            <p className="text-xs text-red-400 font-medium">
              {!form.hasCollateral && 'Select a token to give. '}
              {!form.hasDebt && 'Select a token to receive.'}
            </p>
          </div>
        )}

        {/* Deadline */}
        <div className="space-y-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Expiry</span>
          <div className="flex flex-wrap gap-1.5">
            {SWAP_DEADLINE_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => form.setDeadlinePreset(p.seconds.toString())}
                className={`py-1 px-2.5 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                  form.deadlinePreset === p.seconds.toString()
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Mode</span>
          <div className="flex gap-1">
            {(['offchain', 'onchain'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => form.setMode(m)}
                className={`py-1 px-2.5 rounded-sm text-[10px] font-medium transition-colors cursor-pointer ${
                  form.mode === m
                    ? 'bg-accent/10 text-accent border border-accent/25'
                    : 'text-gray-400 hover:text-white border border-border/40 hover:border-white/20'
                }`}
              >
                {m === 'offchain' ? 'Off-Chain' : 'On-Chain'}
              </button>
            ))}
          </div>
        </div>

        {/* Checking indicator */}
        {form.isChecking && hasTokens && (
          <div className="flex items-center justify-center gap-2 py-3 text-gray-400 text-xs">
            <Spinner className="h-3.5 w-3.5" />
            Checking for matches...
          </div>
        )}

        {/* Match status bar */}
        {hasTokens && showMatches && !form.isChecking && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-accent font-bold uppercase tracking-wider">
              {hasFullMatch ? 'Fully Matched' : hasPartialMatch ? `${coverage}% Matched` : 'Matches Available'}
            </span>
            <span className="text-[10px] text-gray-400">
              {totalMatches} order{totalMatches !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Settings box when no full match */}
        {hasTokens && !hasFullMatch && !form.isChecking && (
          <div className={`rounded-lg border p-3 ${
            hasPartialMatch ? 'border-accent/20 bg-accent/5' : 'border-border/30 bg-surface/5'
          }`}>
            {hasPartialMatch ? (
              <p className="text-xs text-gray-400">
                Swap the matched {coverage}% and create an order for the remainder.
              </p>
            ) : showMatches ? (
              <p className="text-xs text-gray-400">
                Enter amounts to fill existing swaps, or create a new swap order.
              </p>
            ) : (
              <div>
                <p className="text-xs text-white font-medium">No matches found</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Create a swap order to broadcast it to the network.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fee info */}
        {hasTokens && (
          <div className="p-3 bg-accent/5 rounded-xl border border-accent/10 space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Protocol Fee</span>
              <span className={feePreview.savingsBps > 0 ? 'text-green-500' : 'text-white'}>
                {feeText}
                {feePreview.savingsBps > 0 && <span className="text-gray-500 ml-1">(-{feePreview.discountPercent}%)</span>}
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Settlement</span>
              <span className={form.mode === 'offchain' ? 'text-green-500' : 'text-accent'}>
                {form.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Duration</span>
              <span className="text-accent">Instant (0)</span>
            </div>
          </div>
        )}

        {/* Submit button */}
        {hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to swap" centered={false}>
            <Button
              variant="default"
              className="w-full uppercase tracking-[0.15em] text-sm"
              onClick={form.handleSubmit}
              disabled={isProcessing || form.isChecking}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Spinner />
                  Processing...
                </div>
              ) : form.isChecking ? (
                'Checking...'
              ) : hasFullMatch ? (
                'Swap Now'
              ) : hasPartialMatch ? (
                `Swap ${coverage}% + Create Order`
              ) : showMatches && !sel ? (
                'Swap Now'
              ) : form.mode === 'offchain' ? (
                'Sign & Create Swap'
              ) : (
                'Create On-Chain Swap'
              )}
            </Button>
          </Web3ActionWrapper>
        )}

        {!hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to swap" centered={false}>
            <Button variant="default" className="w-full uppercase tracking-wider" disabled>
              Select tokens to swap
            </Button>
          </Web3ActionWrapper>
        )}
      </div>

      {/* Best Trades Panel */}
      {hasTokens && (
        <BestTradesPanel
          offchainMatches={form.offchainMatches}
          onchainMatches={form.onchainMatches}
          isChecking={form.isChecking}
          mode="swap"
          onFill={handleFill}
          isSettling={isProcessing}
        />
      )}

      {/* ── Token Selector Modals ─────────────────────────── */}
      <TokenSelectorModal
        open={openSelector === 'give'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('give', token)}
        selectedAddress={giveAsset.asset}
        showCustomOption={false}
        balances={form.balances}
      />
      <TokenSelectorModal
        open={openSelector === 'receive'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('receive', token)}
        selectedAddress={receiveAsset.asset}
        showCustomOption={false}
        balances={form.balances}
      />

      {/* ── Progress Modals ───────────────────────────────── */}
      {(() => {
        const active = [form.createProgress, form.settleProgress, form.onchainProgress, form.onchainSettleProgress].find(p => p.open)
        const multiOpen = form.multiSettleModalOpen && form.multiSettleState.phase !== 'idle'
        if (active && !multiOpen) {
          return (
            <TransactionProgressModal
              open
              steps={active.steps}
              txHash={active.txHash}
              onClose={active.close}
            />
          )
        }
        if (multiOpen) {
          return (
            <MultiSettleProgressModal
              open
              state={form.multiSettleState}
              onClose={() => {
                form.setMultiSettleModalOpen(false)
                form.resetMultiSettle()
              }}
            />
          )
        }
        return null
      })()}
    </div>
  )
}
