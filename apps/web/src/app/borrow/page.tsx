'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { useOrderForm } from '@/hooks/useOrderForm'
import { useFeePreview } from '@/hooks/useFeePreview'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { FeeBreakdown } from '@/components/FeeBreakdown'
import { BestTradesPanel } from '@/components/trade/BestTradesPanel'
import { TokenBox } from '@/components/trade/TokenBox'
import { Spinner } from '@/components/trade/Spinner'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { formatTokenValue } from '@/lib/format'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import {
  LEND_DEADLINE_PRESETS,
  DURATION_PRESETS,
  formatDurationHuman,
  emptyAsset,
} from '@/lib/trade-constants'

/* ── Borrow Page ─────────────────────────────────────────── */

export default function BorrowPage() {
  const router = useRouter()
  const form = useOrderForm('lending')
  const feePreview = useFeePreview('lending')
  const [openSelector, setOpenSelector] = useState<'debt' | 'collateral' | 'interest' | null>(null)

  const debtAsset = form.debtAssets[0] ?? emptyAsset()
  const collateralAsset = form.collateralAssets[0] ?? emptyAsset()
  const interestAsset = form.interestAssets[0] ?? emptyAsset()

  const debtBalance = debtAsset.asset ? form.balances.get(debtAsset.asset.toLowerCase()) : undefined
  const collateralBalance = collateralAsset.asset ? form.balances.get(collateralAsset.asset.toLowerCase()) : undefined
  const interestBalance = interestAsset.asset ? form.balances.get(interestAsset.asset.toLowerCase()) : undefined

  /* ── Token selection handlers ──── */

  const handleTokenSelect = useCallback((slot: 'debt' | 'collateral' | 'interest', token: TokenInfo) => {
    const addr = token.addresses[NETWORK] ?? ''
    const newAsset: AssetInputValue = {
      asset: addr,
      asset_type: 'ERC20',
      value: '',
      token_id: '0',
      decimals: token.decimals,
    }
    if (slot === 'debt') form.setDebtAssets([newAsset])
    else if (slot === 'collateral') form.setCollateralAssets([newAsset])
    else form.setInterestAssets([newAsset])
    setOpenSelector(null)
  }, [form])

  const handleAmountChange = useCallback((slot: 'debt' | 'collateral' | 'interest', val: string) => {
    if (slot === 'debt') {
      const current = form.debtAssets[0] ?? emptyAsset()
      form.setDebtAssets([{ ...current, value: val }])
    } else if (slot === 'collateral') {
      const current = form.collateralAssets[0] ?? emptyAsset()
      form.setCollateralAssets([{ ...current, value: val }])
    } else {
      const current = form.interestAssets[0] ?? emptyAsset()
      form.setInterestAssets([{ ...current, value: val }])
    }
  }, [form])

  const handleMaxClick = useCallback((slot: 'debt' | 'collateral' | 'interest') => {
    const asset = slot === 'debt' ? debtAsset : slot === 'collateral' ? collateralAsset : interestAsset
    const balance = slot === 'debt' ? debtBalance : slot === 'collateral' ? collateralBalance : interestBalance
    const token = asset.asset ? findTokenByAddress(asset.asset) : null
    if (token && balance) {
      const formatted = formatTokenValue(balance.toString(), token.decimals)
      if (slot === 'debt') form.setDebtAssets([{ ...debtAsset, value: formatted }])
      else if (slot === 'collateral') form.setCollateralAssets([{ ...collateralAsset, value: formatted }])
      else form.setInterestAssets([{ ...interestAsset, value: formatted }])
    }
  }, [form, debtAsset, collateralAsset, interestAsset, debtBalance, collateralBalance, interestBalance])

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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Borrow Assets</h1>
        <p className="text-gray-500 mt-1 font-medium text-sm">
          Borrow tokens by locking collateral and paying interest.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left column -- form */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-2xl">
            {/* Tab toggle */}
            <div className="flex p-1.5 bg-white/[0.02] m-6 rounded-xl border border-border">
              <button
                onClick={() => router.push('/lend')}
                className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                Lend Assets
              </button>
              <button className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.2em] bg-white text-black shadow-xl">
                Borrow Assets
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* 3 Baskets */}
              <div className="space-y-1">
                <TokenBox
                  label="I Want to Borrow"
                  accentClass="text-green-500"
                  borderClass="border-green-500/20"
                  bgClass="bg-green-500/5"
                  asset={debtAsset}
                  balance={debtBalance}
                  onTokenClick={() => setOpenSelector('debt')}
                  onAmountChange={(val) => handleAmountChange('debt', val)}
                />

                <TokenBox
                  label="I'll Lock as Collateral"
                  accentClass="text-orange-400"
                  borderClass="border-orange-400/20"
                  bgClass="bg-orange-400/5"
                  asset={collateralAsset}
                  balance={collateralBalance}
                  onTokenClick={() => setOpenSelector('collateral')}
                  onAmountChange={(val) => handleAmountChange('collateral', val)}
                  onMaxClick={() => handleMaxClick('collateral')}
                />

                <TokenBox
                  label="I'll Pay as Interest"
                  accentClass="text-accent"
                  borderClass="border-accent/20"
                  bgClass="bg-accent/5"
                  asset={interestAsset}
                  balance={interestBalance}
                  onTokenClick={() => setOpenSelector('interest')}
                  onAmountChange={(val) => handleAmountChange('interest', val)}
                  onMaxClick={() => handleMaxClick('interest')}
                />
              </div>

              {/* Validation Errors */}
              {form.showErrors && (!form.hasDebt || !form.hasCollateral) && (
                <div className="px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-red-400 font-medium">
                    {!form.hasDebt && 'Select a token to borrow. '}
                    {!form.hasCollateral && 'Select the collateral to lock.'}
                  </p>
                </div>
              )}

              {/* Duration */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Loan Duration</span>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => form.setDurationPreset(p.seconds.toString())}
                      className={`py-1.5 px-3 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                        form.durationPreset === p.seconds.toString()
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Order Expiry</span>
                <div className="flex flex-wrap gap-1.5">
                  {LEND_DEADLINE_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => form.setDeadlinePreset(p.seconds.toString())}
                      className={`py-1.5 px-3 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                        form.deadlinePreset === p.seconds.toString()
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Mode + Funding */}
              <div className="flex flex-wrap gap-4">
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

                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Funding</span>
                  <div className="flex gap-1">
                    {([
                      { value: 'single', label: 'Single' },
                      { value: 'multi', label: 'Multi' },
                    ] as const).map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => form.setMultiLender(f.value === 'multi')}
                        className={`py-1 px-2.5 rounded-sm text-[10px] font-medium transition-colors cursor-pointer ${
                          (form.multiLender ? 'multi' : 'single') === f.value
                            ? 'bg-accent/10 text-accent border border-accent/25'
                            : 'text-gray-400 hover:text-white border border-border/40 hover:border-white/20'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
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
                      Fill the matched {coverage}% and create an order for the remainder.
                    </p>
                  ) : showMatches ? (
                    <p className="text-xs text-gray-400">
                      Enter amounts to fill existing orders, or create a new borrow order.
                    </p>
                  ) : (
                    <div>
                      <p className="text-xs text-white font-medium">No matches found</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Create a borrow order to broadcast your request to lenders.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Fee breakdown */}
              {hasTokens && <FeeBreakdown type="lending" />}

              {/* Submit button */}
              {hasTokens && (
                <Web3ActionWrapper message="Connect your wallet to borrow" centered={false}>
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
                      'Fill Match'
                    ) : hasPartialMatch ? (
                      `Fill ${coverage}% + Create Order`
                    ) : showMatches && !sel ? (
                      'Fill Match'
                    ) : form.mode === 'offchain' ? (
                      'Sign & Create Borrow Order'
                    ) : (
                      'Create On-Chain Inscription'
                    )}
                  </Button>
                </Web3ActionWrapper>
              )}

              {!hasTokens && (
                <Web3ActionWrapper message="Connect your wallet to borrow" centered={false}>
                  <Button variant="default" className="w-full uppercase tracking-wider" disabled>
                    Select tokens to borrow
                  </Button>
                </Web3ActionWrapper>
              )}

              {/* Best Trades Panel */}
              {hasTokens && (
                <BestTradesPanel
                  offchainMatches={form.offchainMatches}
                  onchainMatches={form.onchainMatches}
                  isChecking={form.isChecking}
                  mode="lending"
                  onFill={handleFill}
                  isSettling={isProcessing}
                />
              )}

              {/* Info strip */}
              {hasTokens && !form.isChecking && (
                <div className="flex items-center justify-center gap-3 text-[11px] text-gray-500">
                  {!hasFullMatch && (
                    <>
                      <span className={form.mode === 'offchain' ? 'text-green-500' : 'text-accent'}>
                        {form.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
                      </span>
                      <span className="text-gray-600">·</span>
                    </>
                  )}
                  <span className={feePreview.savingsBps > 0 ? 'text-green-500' : ''}>
                    {feeText} fee
                    {feePreview.savingsBps > 0 && <span className="text-gray-500 ml-0.5">(-{feePreview.discountPercent}%)</span>}
                  </span>
                  {!hasFullMatch && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>{formatDurationHuman(Number(form.duration))}</span>
                    </>
                  )}
                  {form.roiInfo && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-green-500 font-medium">+{form.roiInfo.yieldPct}%</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column -- summary */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-2xl border border-border p-6 sticky top-24 space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Borrow Summary
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Borrowing</span>
                <span className="font-mono font-bold text-sm text-white">
                  {debtAsset.asset ? (
                    <span className="flex items-center gap-1.5">
                      {debtAsset.value || '0'}{' '}
                      {findTokenByAddress(debtAsset.asset)?.symbol ?? '?'}
                    </span>
                  ) : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Collateral</span>
                <span className="font-mono font-bold text-sm text-white">
                  {collateralAsset.asset ? (
                    <span className="flex items-center gap-1.5">
                      {collateralAsset.value || '0'}{' '}
                      {findTokenByAddress(collateralAsset.asset)?.symbol ?? '?'}
                    </span>
                  ) : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Interest</span>
                <span className="font-mono font-bold text-sm text-white">
                  {interestAsset.asset ? (
                    <span className="flex items-center gap-1.5">
                      {interestAsset.value || '0'}{' '}
                      {findTokenByAddress(interestAsset.asset)?.symbol ?? '?'}
                    </span>
                  ) : '--'}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Duration</span>
                <span className="font-bold text-sm text-white">
                  {formatDurationHuman(Number(form.duration))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Protocol Fee</span>
                <span className="font-bold text-sm text-white">{feeText}</span>
              </div>
              {form.roiInfo && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Interest Rate</span>
                  <span className="font-bold text-sm text-orange-400">+{form.roiInfo.yieldPct}%</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Mode</span>
                <span className="text-xs font-bold text-accent flex items-center gap-1.5 uppercase tracking-widest">
                  {form.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Funding</span>
                <span className="text-xs font-bold text-white uppercase tracking-widest">
                  {form.multiLender ? 'Multi-Lender' : 'Single Lender'}
                </span>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-xl p-4 border border-border space-y-3">
              <div className="flex items-center gap-2 text-accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">Collateral Protected</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Your collateral is locked in a StarkNet smart contract locker. Repay the loan to unlock it. Pro-rata interest means you only pay for time borrowed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Token Selector Modals ─────────────────────────── */}
      <TokenSelectorModal
        open={openSelector === 'debt'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('debt', token)}
        selectedAddress={debtAsset.asset}
        showCustomOption={false}
        balances={form.balances}
      />
      <TokenSelectorModal
        open={openSelector === 'collateral'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('collateral', token)}
        selectedAddress={collateralAsset.asset}
        showCustomOption={false}
        balances={form.balances}
      />
      <TokenSelectorModal
        open={openSelector === 'interest'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('interest', token)}
        selectedAddress={interestAsset.asset}
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
