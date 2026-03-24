'use client'

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react'
import { useQueryState } from 'nuqs'
import { tradeParsers } from './search-params'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { NETWORK, CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import { useOrderForm, ROLES } from '@/hooks/useOrderForm'
import type { AssetRole } from '@/hooks/useOrderForm'
import { useCollectionOffer } from '@/hooks/useCollectionOffer'
import { useAcceptCollectionOffer } from '@/hooks/useAcceptCollectionOffer'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import type { AssetInputValue } from '@/components/AssetInput'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { NFTCollectionSelector } from '@/components/NFTCollectionSelector'
import type { NFTCollectionInfo } from '@/components/NFTCollectionSelector'
import { TokenAvatar } from '@/components/TokenAvatar'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { InlineMatchList } from '@/components/InlineMatchList'
import { FeeBreakdown } from '@/components/FeeBreakdown'
import { OrderBook } from '@/components/orderbook/OrderBook'
import { useOrderBook } from '@/hooks/useOrderBook'
import type { DurationFilter } from '@/types/orderbook'
import { formatTokenValue, formatTimestamp } from '@/lib/format'
import { BestTradesPanel } from '@/components/trade/BestTradesPanel'
import { SettlementDrawer, type SettlementSummary } from '@/components/trade/SettlementDrawer'
import {
  SWAP_DEADLINE_PRESETS,
  LEND_DEADLINE_PRESETS,
  DURATION_PRESETS,
  formatDurationHuman,
  emptyAsset,
} from '@/lib/trade-constants'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import { formatAddress } from '@/lib/address'
import { useFeePreview } from '@/hooks/useFeePreview'
import { NFTTokenPicker } from '@/components/NFTTokenPicker'
import { InlineBorrowForm } from '@/app/borrow/components/InlineBorrowForm'
import { AddAssetModal } from '@/app/borrow/components/AddAssetModal'
import { AssetRow } from '@/app/borrow/components/AssetRow'

/* ── Constants ──────────────────────────────────────────── */

const CUSTOM_DURATION_UNITS = [
  { label: 'Days', multiplier: 86400 },
  { label: 'Weeks', multiplier: 604800 },
  { label: 'Months', multiplier: 2592000 },
]

/* ── Spinner ─────────────────────────────────────────────── */

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/* ── Token Input Box ─────────────────────────────────────── */

function TokenBox({
  label,
  accentClass,
  borderClass,
  bgClass,
  asset,
  balance,
  onTokenClick,
  onAmountChange,
  onMaxClick,
}: {
  label: string
  accentClass: string
  borderClass: string
  bgClass: string
  asset: AssetInputValue
  balance?: bigint
  onTokenClick: () => void
  onAmountChange: (val: string) => void
  onMaxClick?: () => void
}) {
  const token = asset.asset ? findTokenByAddress(asset.asset) : null

  return (
    <div className={`${bgClass} border ${borderClass} rounded-lg p-3 sm:p-4 overflow-hidden`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accentClass}`}>{label}</span>
        {token && balance !== undefined && balance > 0n && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-mono">
              {formatTokenValue(balance.toString(), token.decimals)}
            </span>
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-[10px] text-accent hover:text-accent/80 font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onTokenClick}
          className="flex items-center gap-1.5 sm:gap-2 h-10 px-2 sm:px-3 rounded-md bg-surface/60 border border-border/40 text-sm transition-colors hover:bg-surface-hover hover:border-white/20 cursor-pointer shrink-0"
        >
          {token ? (
            <>
              <TokenAvatar token={token} size={20} />
              <span className="text-white font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-gray-400">Select</span>
          )}
          <svg className="text-gray-500 ml-1" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={asset.value}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || /^\d*\.?\d{0,18}$/.test(raw)) onAmountChange(raw)
          }}
          className="flex-1 min-w-0 text-right text-lg sm:text-xl font-mono bg-transparent outline-none text-white placeholder:text-gray-500/40"
        />
      </div>
    </div>
  )
}

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

/* ── Order Settings ──────────────────────────────────────── */

function OrderSettings({
  form,
  isLend,
  deadlinePresets,
}: {
  form: ReturnType<typeof useOrderForm>
  isLend: boolean
  deadlinePresets: { label: string; seconds: number }[]
}) {
  return (
    <div className="space-y-3">
      {/* Mode */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Mode</span>
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

      {/* Duration (lend only) */}
      {isLend && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Duration</span>
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => form.setDurationPreset(p.seconds.toString())}
                className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                  form.durationPreset === p.seconds.toString() ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Expiry */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Expiry</span>
        <div className="flex flex-wrap gap-1">
          {deadlinePresets.map((p) => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => form.setDeadlinePreset(p.seconds.toString())}
              className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                form.deadlinePreset === p.seconds.toString() ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Funding (lend only) */}
      {isLend && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Funding</span>
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
      )}
    </div>
  )
}

/* ── Trade Form (Swap / Lend modes) ──────────────────────── */

function TradeForm({
  mode,
  initialDebtToken,
  initialCollateralToken,
}: {
  mode: 'swap' | 'lend'
  initialDebtToken?: string
  initialCollateralToken?: string
}) {
  const isLend = mode === 'lend'
  const form = useOrderForm(isLend ? 'lending' : 'swap')
  const feePreview = useFeePreview(isLend ? 'lending' : 'swap')
  const [openSelector, setOpenSelector] = useState<'give' | 'receive' | 'interest' | null>(null)
  const hasPreFilled = useRef(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerOrder, setDrawerOrder] = useState<MatchedOrder | OnChainMatch | null>(null)
  const [drawerSource, setDrawerSource] = useState<'offchain' | 'onchain'>('offchain')

  const giveAsset = form.collateralAssets[0] ?? emptyAsset()
  const receiveAsset = form.debtAssets[0] ?? emptyAsset()
  const interestAsset = form.interestAssets[0] ?? emptyAsset()

  const giveToken = giveAsset.asset ? findTokenByAddress(giveAsset.asset) : null

  const giveBalance = giveAsset.asset ? form.balances.get(giveAsset.asset.toLowerCase()) : undefined
  const receiveBalance = receiveAsset.asset ? form.balances.get(receiveAsset.asset.toLowerCase()) : undefined
  const interestBalance = interestAsset.asset ? form.balances.get(interestAsset.asset.toLowerCase()) : undefined

  /* ── Prop-driven pre-fill (runs once on mount) ── */
  useEffect(() => {
    if (hasPreFilled.current) return
    if (!initialCollateralToken && !initialDebtToken) return
    hasPreFilled.current = true

    if (initialCollateralToken) {
      const token = findTokenByAddress(initialCollateralToken)
      form.setCollateralAssets([{
        asset: token ? (token.addresses[NETWORK] ?? initialCollateralToken) : initialCollateralToken,
        asset_type: 'ERC20',
        value: '',
        token_id: '0',
        decimals: token?.decimals ?? 18,
      }])
    }
    if (initialDebtToken) {
      const token = findTokenByAddress(initialDebtToken)
      form.setDebtAssets([{
        asset: token ? (token.addresses[NETWORK] ?? initialDebtToken) : initialDebtToken,
        asset_type: 'ERC20',
        value: '',
        token_id: '0',
        decimals: token?.decimals ?? 18,
      }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount to pre-fill from props

  /* ── Token selection handlers ──── */

  const handleTokenSelect = useCallback((slot: 'give' | 'receive' | 'interest', token: TokenInfo) => {
    const addr = token.addresses[NETWORK] ?? ''
    const newAsset: AssetInputValue = {
      asset: addr,
      asset_type: 'ERC20',
      value: '',
      token_id: '0',
      decimals: token.decimals,
    }
    if (slot === 'give') form.setCollateralAssets([newAsset])
    else if (slot === 'receive') form.setDebtAssets([newAsset])
    else form.setInterestAssets([newAsset])
    setOpenSelector(null)
  }, [form])

  const handleAmountChange = useCallback((slot: 'give' | 'receive' | 'interest', val: string) => {
    if (slot === 'give') {
      const current = form.collateralAssets[0] ?? emptyAsset()
      form.setCollateralAssets([{ ...current, value: val }])
    } else if (slot === 'receive') {
      const current = form.debtAssets[0] ?? emptyAsset()
      form.setDebtAssets([{ ...current, value: val }])
    } else {
      const current = form.interestAssets[0] ?? emptyAsset()
      form.setInterestAssets([{ ...current, value: val }])
    }
  }, [form])

  const handleSwapDirection = useCallback(() => {
    const oldGive = form.collateralAssets
    const oldReceive = form.debtAssets
    form.setCollateralAssets(oldReceive)
    form.setDebtAssets(oldGive)
  }, [form])

  const handleMaxClick = useCallback((slot: 'give' | 'interest') => {
    if (slot === 'give' && giveToken && giveBalance) {
      const formatted = formatTokenValue(giveBalance.toString(), giveToken.decimals)
      const current = form.collateralAssets[0] ?? emptyAsset()
      form.setCollateralAssets([{ ...current, value: formatted }])
    } else if (slot === 'interest') {
      const token = interestAsset.asset ? findTokenByAddress(interestAsset.asset) : null
      if (token && interestBalance) {
        const formatted = formatTokenValue(interestBalance.toString(), token.decimals)
        const current = form.interestAssets[0] ?? emptyAsset()
        form.setInterestAssets([{ ...current, value: formatted }])
      }
    }
  }, [form, giveToken, giveBalance, interestAsset, interestBalance])

  /* ── Match state analysis ──── */

  const hasTokens = form.hasDebt && form.hasCollateral
  const showMatches = form.matchesVisible && form.hasMatches
  const totalMatches = showMatches ? form.offchainMatches.length + form.onchainMatches.length : 0
  const sel = form.multiSettleSelection
  const coverage = sel?.coverage ?? 0
  const hasFullMatch = showMatches && sel != null && coverage >= 100
  const hasPartialMatch = showMatches && sel != null && coverage > 0 && coverage < 100
  const isProcessing = form.isPending || form.isCreatingOnChain || form.isSettling || form.isSettlingOnChain || form.multiSettleState.phase !== 'idle'

  const deadlinePresets = isLend ? LEND_DEADLINE_PRESETS : SWAP_DEADLINE_PRESETS
  const feeText = (feePreview.effectiveTotalBps / 100).toFixed(2) + '%'

  const handleFill = useCallback((order: MatchedOrder | OnChainMatch, source: 'offchain' | 'onchain') => {
    setDrawerOrder(order)
    setDrawerSource(source)
    setDrawerOpen(true)
  }, [])

  return (
    <>
      {/* ── Token Input Boxes ─────────────────────────────── */}
      <div className="space-y-1">
        <TokenBox
          label={isLend ? "I'll put up" : 'I give'}
          accentClass="text-accent"
          borderClass="border-accent/20"
          bgClass="bg-accent/5"
          asset={giveAsset}
          balance={giveBalance}
          onTokenClick={() => setOpenSelector('give')}
          onAmountChange={(val) => handleAmountChange('give', val)}
          onMaxClick={() => handleMaxClick('give')}
        />

        <DirectionArrow onClick={handleSwapDirection} />

        <TokenBox
          label={isLend ? "I'll borrow" : 'I receive'}
          accentClass="text-green-500"
          borderClass="border-green-500/20"
          bgClass="bg-green-500/5"
          asset={receiveAsset}
          balance={receiveBalance}
          onTokenClick={() => setOpenSelector('receive')}
          onAmountChange={(val) => handleAmountChange('receive', val)}
        />

        {isLend && (
          <div className="pt-1">
            <TokenBox
              label="Interest"
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
        )}
      </div>

      {/* ── Validation Errors ─────────────────────────────── */}
      {form.showErrors && (!form.hasDebt || !form.hasCollateral) && (
        <div className="mt-3 px-4 py-3 rounded-lg border border-nova/20 bg-red-500/5">
          <p className="text-xs text-nova font-medium">
            {!form.hasCollateral && `• Select a token to ${isLend ? 'put up' : 'give'}. `}
            {!form.hasDebt && `• Select a token to ${isLend ? 'borrow' : 'receive'}.`}
          </p>
        </div>
      )}

      {/* ── Bottom Section ────────────────────────────────── */}
      <div className="mt-4 space-y-3">
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

        {/* Creation / settings box — shown when no full match */}
        {hasTokens && !hasFullMatch && !form.isChecking && (
          <div className={`rounded-lg border p-4 space-y-3 ${
            hasPartialMatch ? 'border-accent/20 bg-accent/5' : 'border-border/30 bg-surface/5'
          }`}>
            {hasPartialMatch ? (
              <p className="text-xs text-gray-400">
                Fill the matched {coverage}% and create an order for the remainder.
              </p>
            ) : showMatches ? (
              <p className="text-xs text-gray-400">
                Enter amounts to fill existing orders, or configure and create a new Stela.
              </p>
            ) : (
              <div>
                <p className="text-xs text-white font-medium">No matches found</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Create a Stela to broadcast your order to the network.
                </p>
              </div>
            )}
            <OrderSettings form={form} isLend={isLend} deadlinePresets={deadlinePresets} />
          </div>
        )}

        {/* Fee breakdown */}
        {hasTokens && (
          <FeeBreakdown type={isLend ? 'lending' : 'swap'} />
        )}

        {/* Submit button */}
        {hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to trade" centered={false}>
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
                isLend ? 'Fill Order' : 'Swap Now'
              ) : hasPartialMatch ? (
                `Fill ${coverage}% + Create Order`
              ) : showMatches && !sel ? (
                isLend ? 'Fill Order' : 'Swap Now'
              ) : form.mode === 'offchain' ? (
                'Sign & Create'
              ) : (
                'Create On-Chain'
              )}
            </Button>
          </Web3ActionWrapper>
        )}

        {/* Best Trades Panel */}
        {hasTokens && (
          <BestTradesPanel
            offchainMatches={form.offchainMatches}
            onchainMatches={form.onchainMatches}
            isChecking={form.isChecking}
            mode={isLend ? 'lending' : 'swap'}
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
            {isLend && !hasFullMatch && (
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

        {/* Not ready — no tokens */}
        {!hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to trade" centered={false}>
            <Button variant="default" className="w-full uppercase tracking-wider" disabled>
              Select tokens
            </Button>
          </Web3ActionWrapper>
        )}
      </div>

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
      {isLend && (
        <TokenSelectorModal
          open={openSelector === 'interest'}
          onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
          onSelect={(token) => handleTokenSelect('interest', token)}
          selectedAddress={interestAsset.asset}
          showCustomOption={false}
          balances={form.balances}
        />
      )}

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

      {/* ── Settlement Drawer ──────────────────────────────── */}
      {drawerOpen && drawerOrder && (
        <SettlementDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          feeType={drawerSource === 'offchain' && !isLend ? 'swap' : isLend ? 'lending' : 'swap'}
          mode="single"
          order={drawerOrder as MatchedOrder}
        />
      )}
    </>
  )
}

/* ── Advanced Form (multi-asset borrow) ──────────────────── */

function AdvancedForm({ debtToken, collateralToken }: { debtToken: string | null; collateralToken: string | null }) {
  const form = useOrderForm('lending')
  const [showMultiAsset, setShowMultiAsset] = useState(false)
  const hasPreFilled = useRef(false)

  /* ── URL param pre-fill (runs once on mount) ── */
  useEffect(() => {
    if (hasPreFilled.current) return
    const debtParam = debtToken
    const collateralParam = collateralToken
    if (!debtParam && !collateralParam) return
    hasPreFilled.current = true

    if (debtParam) {
      const token = findTokenByAddress(debtParam)
      form.setDebtAssets([{
        asset: token ? (token.addresses[NETWORK] ?? debtParam) : debtParam,
        asset_type: 'ERC20',
        value: '',
        token_id: '0',
        decimals: token?.decimals ?? 18,
      }])
    }
    if (collateralParam) {
      const token = findTokenByAddress(collateralParam)
      form.setCollateralAssets([{
        asset: token ? (token.addresses[NETWORK] ?? collateralParam) : collateralParam,
        asset_type: 'ERC20',
        value: '',
        token_id: '0',
        decimals: token?.decimals ?? 18,
      }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount to pre-fill from URL params

  return (
    <div className="space-y-6">

      {/* Reset */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={form.resetForm}
          className="text-gray-500 hover:text-nova text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* ── Token Selection ─────────────────────────────── */}
      <InlineBorrowForm
        orderType="lending"
        debtAssets={form.debtAssets}
        collateralAssets={form.collateralAssets}
        interestAssets={form.interestAssets}
        onDebtChange={form.setDebtAssets}
        onCollateralChange={form.setCollateralAssets}
        onInterestChange={form.setInterestAssets}
        balances={form.balances}
      />

      {/* ── Terms & Duration ─────────────────────────────── */}
      <section className="rounded-xl border border-border/30 bg-surface/5 overflow-clip">
        <div className="px-4 py-2.5 border-b border-border/30 bg-surface/10">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Terms & Duration</span>
        </div>

        <div className="p-4 flex flex-col md:flex-row md:items-start gap-6">
          {/* Duration */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Loan Duration</span>
              <button
                type="button"
                onClick={() => form.setUseCustomDuration(!form.useCustomDuration)}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors cursor-pointer font-bold uppercase tracking-wider"
              >
                {form.useCustomDuration ? 'Use Presets' : 'Custom'}
              </button>
            </div>

            {form.useCustomDuration ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={form.customDurationValue}
                    onChange={(e) => form.setCustomDurationValue(e.target.value)}
                    className="flex-1 bg-surface/50 border-border/50 font-mono h-9 text-sm"
                    placeholder="Amount"
                    min="1"
                  />
                  <div className="flex gap-1">
                    {CUSTOM_DURATION_UNITS.map((u) => (
                      <button
                        key={u.multiplier}
                        type="button"
                        onClick={() => form.setCustomDurationUnit(u.multiplier)}
                        className={`px-3 py-1 rounded-lg text-[10px] border transition-all cursor-pointer font-medium ${
                          form.customDurationUnit === u.multiplier
                            ? 'border-accent/40 bg-accent/10 text-accent'
                            : 'border-border/50 text-gray-400 hover:text-white'
                        }`}
                      >{u.label}</button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 italic">
                  Result: {formatDurationHuman(Number(form.duration))}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => form.setDurationPreset(p.seconds.toString())}
                    className={`py-2 px-4 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                      form.durationPreset === p.seconds.toString()
                        ? 'border-accent/40 bg-accent/10 text-accent shadow-[0_0_10px_rgba(232,168,37,0.1)]'
                        : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px self-stretch bg-white/[0.08]" />

          {/* Deadline / Expiry */}
          <div className="space-y-3 flex-1 min-w-0">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block">Order Expiry</span>
            <div className="flex flex-wrap gap-2">
              {LEND_DEADLINE_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => form.setDeadlinePreset(p.seconds.toString())}
                  className={`py-2 px-4 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                    form.deadlinePreset === p.seconds.toString()
                      ? 'border-accent/40 bg-accent/10 text-accent shadow-[0_0_10px_rgba(232,168,37,0.1)]'
                      : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >{p.label}</button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400" suppressHydrationWarning>
              Expires {formatTimestamp(BigInt(form.deadline))}
            </p>
          </div>
        </div>
      </section>

      {/* ── Multi-Asset Options (collapsible) ─────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setShowMultiAsset(!showMultiAsset)}
          className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-white uppercase tracking-widest font-bold transition-colors cursor-pointer group"
        >
          <svg
            className={`w-3 h-3 text-gray-500 group-hover:text-white transition-transform ${showMultiAsset ? 'rotate-90' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          Multi-Asset Options
          {form.allAssets.length > 0 && <span className="text-accent">({form.allAssets.length} assets)</span>}
        </button>

        {showMultiAsset && (
          <div className="mt-4 space-y-4 animate-fade-up">
            {/* Mode + Funding toggles */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {/* Mode */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold whitespace-nowrap">Mode</span>
                <div className="flex gap-1">
                  {(['offchain', 'onchain'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => form.setMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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

              <div className="w-px h-5 bg-white/10 hidden sm:block" />

              {/* Funding */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold whitespace-nowrap">Funding</span>
                <div className="flex gap-1">
                  {([
                    { value: 'single', label: 'Single' },
                    { value: 'multi', label: 'Multi' },
                  ] as const).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => form.setMultiLender(f.value === 'multi')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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

            {/* Asset Table */}
            <section className="rounded-xl border border-border/30 overflow-clip bg-surface/5">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-surface/10">
                <span className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">
                  Inscription Assets
                  {form.allAssets.length > 0 && <span className="ml-2 text-accent">({form.allAssets.length})</span>}
                </span>
                <button
                  type="button"
                  onClick={() => form.setAddModalOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors font-medium cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2v8M2 6h8" />
                  </svg>
                  Add Asset
                </button>
              </div>

              <div className="hidden md:flex items-center px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-bold border-b border-border/20 bg-[#050505]/30">
                <div className="flex-1">Asset</div>
                <div className="w-32 text-center">Amount / ID</div>
                <div className="w-32 text-center">Role</div>
                <div className="w-10"></div>
              </div>

              {form.allAssets.length === 0 ? (
                <div
                  onClick={() => form.setAddModalOpen(true)}
                  className="w-full min-h-[120px] hover:bg-surface/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface/30 border border-border/50 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400">Add extra assets via the modal for multi-asset orders</p>
                </div>
              ) : (
                <div className="divide-y divide-edge/10">
                  {form.allAssets.map((item) => (
                    <AssetRow
                      key={`${item.role}-${item.asset.asset}-${item.asset.token_id}`}
                      asset={item.asset}
                      role={item.role}
                      onRemove={() => form.handleRemoveAsset(item.role, item.index)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ── Validation Errors ──────────────────────────────── */}
      {form.showErrors && (!form.hasDebt || !form.hasCollateral) && (
        <div className="px-4 py-3 rounded-xl border border-nova/20 bg-red-500/5">
          <p className="text-xs text-nova font-medium">
            {!form.hasDebt && '• Add at least one borrow asset. '}
            {!form.hasCollateral && '• Add at least one collateral asset.'}
          </p>
        </div>
      )}

      {/* ── Agreement Summary + Submit ─────────────────────── */}
      <section className="rounded-xl border border-accent/30 bg-accent/5 p-5 max-w-md">
        <div className="space-y-3">
          <span className="text-[11px] text-accent uppercase tracking-[0.2em] font-bold block border-b border-accent/20 pb-2">
            Agreement Summary
          </span>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Intent</span>
              <span className="text-white font-medium uppercase tracking-wider">Lending</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network Mode</span>
              <span className={`font-medium ${form.mode === 'onchain' ? 'text-accent' : 'text-white'}`}>
                {form.mode === 'offchain' ? 'Gasless (Off-Chain)' : 'On-Chain'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span className="text-white font-medium">{formatDurationHuman(Number(form.duration))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Expiry</span>
              <span className="text-white font-medium" suppressHydrationWarning>{formatTimestamp(BigInt(form.deadline))}</span>
            </div>
            {form.roiInfo && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Est. Yield</span>
                <span className="text-green-500 font-bold">+{form.roiInfo.yieldPct}%</span>
              </div>
            )}
            {form.matchesVisible && form.hasMatches && (
              <div className="flex justify-between items-center text-sm pt-1 border-t border-accent/10">
                <span className="text-gray-400">Broadcast</span>
                <Switch
                  size="sm"
                  checked={form.broadcastMode}
                  onCheckedChange={form.setBroadcastMode}
                  className="data-[state=checked]:bg-accent"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <FeeBreakdown type="lending" />
        </div>

        <div className="mt-5">
          <Web3ActionWrapper message="Connect your wallet to create an inscription">
            <Button
              variant="default"
              size="lg"
              className="w-full h-14 uppercase tracking-[0.2em] text-sm shadow-[0_0_20px_rgba(232,168,37,0.15)] hover:shadow-[0_0_30px_rgba(232,168,37,0.25)] transition-all"
              onClick={form.handleSubmit}
              disabled={form.isPending || form.isCreatingOnChain || form.isChecking}
            >
              {form.isPending || form.isCreatingOnChain ? (
                <div className="flex items-center gap-2">
                  <Spinner />
                  Processing...
                </div>
              ) : form.isChecking ? 'Checking matches...' : form.submitButtonText}
            </Button>
          </Web3ActionWrapper>
        </div>
      </section>

      {/* ── Match Detection ──────────────────────────────── */}
      {form.matchesVisible && form.hasMatches && !form.broadcastMode && (
        <div>
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-accent uppercase">
              Match Detected
            </span>
          </div>
          <InlineMatchList
            offchainMatches={form.offchainMatches}
            onchainMatches={form.onchainMatches}
            isSwap={false}
            onSettleOffchain={form.handleInstantSettle}
            onSettleOnchain={form.handleOnchainSettle}
            onSettleMultiple={form.handleMultiSettle}
            isSettling={form.isSettling || form.isSettlingOnChain || form.multiSettleState.phase !== 'idle'}
            multiSettleSelection={form.multiSettleSelection}
            giveSymbol={form.giveSymbol}
            receiveSymbol={form.receiveSymbol}
          />
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
      <AddAssetModal
        open={form.addModalOpen}
        onOpenChange={(open) => form.setAddModalOpen(open)}
        onAdd={form.handleAddAsset}
        balances={form.balances}
        availableRoles={ROLES}
        defaultRole={form.advancedDefaultRole}
      />

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

/* ── Collection Offer Form ────────────────────────────────── */

function CollectionOfferForm() {
  const { address } = useAccount()
  const { createCollectionOffer, isPending } = useCollectionOffer()
  const { balances } = useTokenBalances()

  const [collectionAddress, setCollectionAddress] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<NFTCollectionInfo | null>(null)
  const [collectionSelectorOpen, setCollectionSelectorOpen] = useState(false)
  const [debtAsset, setDebtAsset] = useState<AssetInputValue>(emptyAsset())
  const [interestAsset, setInterestAsset] = useState<AssetInputValue>(emptyAsset())
  const [openSelector, setOpenSelector] = useState<'debt' | 'interest' | null>(null)
  const [durationPreset, setDurationPreset] = useState('86400')
  const [deadlinePreset, setDeadlinePreset] = useState('604800')
  const [showErrors, setShowErrors] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  const debtToken = debtAsset.asset ? findTokenByAddress(debtAsset.asset) : null
  const interestToken = interestAsset.asset ? findTokenByAddress(interestAsset.asset) : null

  const debtBalance = debtAsset.asset ? balances.get(debtAsset.asset.toLowerCase()) : undefined
  const interestBalance = interestAsset.asset ? balances.get(interestAsset.asset.toLowerCase()) : undefined

  const isValidAddress = /^0x[0-9a-fA-F]{1,64}$/.test(collectionAddress)
  const hasDebt = Boolean(debtAsset.asset && debtAsset.value)
  const isValid = isValidAddress && hasDebt

  const feePreview = useFeePreview('lending')
  const feeText = (feePreview.effectiveTotalBps / 100).toFixed(2) + '%'

  const handleTokenSelect = useCallback((slot: 'debt' | 'interest', token: TokenInfo) => {
    const addr = token.addresses[NETWORK] ?? ''
    const newAsset: AssetInputValue = {
      asset: addr,
      asset_type: 'ERC20',
      value: '',
      token_id: '0',
      decimals: token.decimals,
    }
    if (slot === 'debt') setDebtAsset(newAsset)
    else setInterestAsset(newAsset)
    setOpenSelector(null)
  }, [])

  const handleMaxClick = useCallback((slot: 'debt' | 'interest') => {
    if (slot === 'debt' && debtToken && debtBalance) {
      setDebtAsset(prev => ({ ...prev, value: formatTokenValue(debtBalance.toString(), debtToken.decimals) }))
    } else if (slot === 'interest' && interestToken && interestBalance) {
      setInterestAsset(prev => ({ ...prev, value: formatTokenValue(interestBalance.toString(), interestToken.decimals) }))
    }
  }, [debtToken, debtBalance, interestToken, interestBalance])

  const handleSubmit = useCallback(async () => {
    setShowErrors(true)
    if (!isValid || !address) return

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlinePreset))
    const duration = BigInt(durationPreset)
    const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

    const debtAssets = [{
      asset_address: debtAsset.asset,
      asset_type: debtAsset.asset_type,
      value: parseAmount(debtAsset.value || '0', debtAsset.decimals).toString(),
      token_id: '0',
    }]

    const interestAssets = interestAsset.asset && interestAsset.value ? [{
      asset_address: interestAsset.asset,
      asset_type: interestAsset.asset_type,
      value: parseAmount(interestAsset.value || '0', interestAsset.decimals).toString(),
      token_id: '0',
    }] : []

    await createCollectionOffer({
      collectionAddress,
      debtAssets,
      interestAssets,
      debtCount: debtAssets.length,
      interestCount: interestAssets.length,
      duration,
      deadline,
      nonce,
    })

    // Reset form on success
    setCollectionAddress('')
    setSelectedCollection(null)
    setDebtAsset(emptyAsset())
    setInterestAsset(emptyAsset())
    setShowErrors(false)
  }, [isValid, address, deadlinePreset, durationPreset, provider, debtAsset, interestAsset, collectionAddress, createCollectionOffer])

  return (
    <>
      {/* Collection Address */}
      <div className="space-y-1">
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-accent">Collection</span>
          </div>
          <button
            type="button"
            onClick={() => setCollectionSelectorOpen(true)}
            className="w-full flex items-center gap-3 py-2 px-1 rounded-lg transition-colors text-left hover:bg-accent/5"
          >
            {selectedCollection ? (
              <>
                <div className="relative shrink-0 rounded-lg overflow-hidden bg-white/[0.06]" style={{ width: 40, height: 40 }}>
                  {selectedCollection.image ? (
                    <img
                      src={selectedCollection.image}
                      alt={selectedCollection.name}
                      width={40}
                      height={40}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-semibold">
                      {selectedCollection.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{selectedCollection.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono truncate">{formatAddress(selectedCollection.address)}</div>
                </div>
              </>
            ) : (
              <>
                <div className="shrink-0 w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                    <path d="M6 6h4M6 10h4" />
                  </svg>
                </div>
                <span className="text-sm text-gray-500/60">Select Collection</span>
              </>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-gray-400 ml-auto">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>
          {showErrors && !isValidAddress && collectionAddress && (
            <p className="text-[10px] text-nova mt-1">Invalid StarkNet address</p>
          )}
        </div>

        {/* Debt (what lender offers) */}
        <TokenBox
          label="I'll lend"
          accentClass="text-green-500"
          borderClass="border-green-500/20"
          bgClass="bg-green-500/5"
          asset={debtAsset}
          balance={debtBalance}
          onTokenClick={() => setOpenSelector('debt')}
          onAmountChange={(val) => setDebtAsset(prev => ({ ...prev, value: val }))}
          onMaxClick={() => handleMaxClick('debt')}
        />

        {/* Interest */}
        <div className="pt-1">
          <TokenBox
            label="Interest"
            accentClass="text-accent"
            borderClass="border-accent/20"
            bgClass="bg-accent/5"
            asset={interestAsset}
            balance={interestBalance}
            onTokenClick={() => setOpenSelector('interest')}
            onAmountChange={(val) => setInterestAsset(prev => ({ ...prev, value: val }))}
            onMaxClick={() => handleMaxClick('interest')}
          />
        </div>
      </div>

      {/* Validation */}
      {showErrors && !isValid && (
        <div className="mt-3 px-4 py-3 rounded-lg border border-nova/20 bg-red-500/5">
          <p className="text-xs text-nova font-medium">
            {!isValidAddress && '• Enter a valid collection address. '}
            {!hasDebt && '• Select a token and amount to lend.'}
          </p>
        </div>
      )}

      {/* Settings */}
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-border/30 bg-surface/5 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Duration</span>
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setDurationPreset(p.seconds.toString())}
                  className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                    durationPreset === p.seconds.toString() ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold shrink-0 w-16">Expiry</span>
            <div className="flex flex-wrap gap-1">
              {LEND_DEADLINE_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setDeadlinePreset(p.seconds.toString())}
                  className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                    deadlinePreset === p.seconds.toString() ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <Web3ActionWrapper message="Connect your wallet to create a collection offer" centered={false}>
          <Button
            variant="default"
            className="w-full uppercase tracking-[0.15em] text-sm"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Spinner />
                Processing...
              </div>
            ) : (
              'Sign & Create Collection Offer'
            )}
          </Button>
        </Web3ActionWrapper>

        {/* Info strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="text-green-500">Gasless</span>
          <span className="text-gray-600">·</span>
          <span className={feePreview.savingsBps > 0 ? 'text-green-500' : ''}>
            {feeText} fee
            {feePreview.savingsBps > 0 && <span className="text-gray-500 ml-0.5">(-{feePreview.discountPercent}%)</span>}
          </span>
          <span className="text-gray-600">·</span>
          <span>{formatDurationHuman(Number(durationPreset))}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400">Any NFT in collection</span>
        </div>
      </div>

      {/* Token Selector Modals */}
      <TokenSelectorModal
        open={openSelector === 'debt'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('debt', token)}
        selectedAddress={debtAsset.asset}
        showCustomOption={false}
        balances={balances}
      />
      <TokenSelectorModal
        open={openSelector === 'interest'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('interest', token)}
        selectedAddress={interestAsset.asset}
        showCustomOption={false}
        balances={balances}
      />
      <NFTCollectionSelector
        open={collectionSelectorOpen}
        onClose={() => setCollectionSelectorOpen(false)}
        onSelect={(collection) => {
          setCollectionAddress(collection.address)
          setSelectedCollection(collection)
        }}
      />
    </>
  )
}

/* ── Collection Offer Browser ─────────────────────────────── */

interface CollectionOfferRow {
  id: string
  lender: string
  collection_address: string
  order_data: string
  status: string
  deadline: string
  debt_token: string | null
  created_at: string
}

interface ParsedOfferData {
  debtAssets?: Array<{ asset_address: string; value: string }>
  interestAssets?: Array<{ asset_address: string; value: string }>
  duration?: string
}

function CollectionOfferBrowser() {
  const { address } = useAccount()
  const { acceptOffer, isPending: isAccepting } = useAcceptCollectionOffer()
  const [offers, setOffers] = useState<CollectionOfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/collection-offers?status=pending&limit=20')
      if (res.ok) {
        const json = (await res.json()) as { data?: CollectionOfferRow[] }
        setOffers(json.data ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => { fetchOffers() }, [fetchOffers])

  const handleAccept = useCallback(async (offer: CollectionOfferRow) => {
    if (!address || !tokenId) return
    setAcceptingId(offer.id)
    try {
      const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)
      await acceptOffer(offer.id, offer.id, tokenId, nonce)
      setExpandedId(null)
      setTokenId('')
      fetchOffers()
    } catch {
      // error handled by hook toast
    } finally {
      setAcceptingId(null)
    }
  }, [address, tokenId, provider, acceptOffer, fetchOffers])

  const parseOrderData = useCallback((raw: string): ParsedOfferData => {
    try { return JSON.parse(raw) as ParsedOfferData } catch { return {} }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-xs">
        <Spinner className="h-3.5 w-3.5" />
        Loading collection offers...
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">No open collection offers</p>
        <p className="text-[11px] text-gray-500 mt-1">Collection offers from lenders will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {offers.map((offer) => {
        const data = parseOrderData(offer.order_data)
        const debtAddr = data.debtAssets?.[0]?.asset_address
        const debtValue = data.debtAssets?.[0]?.value
        const debtToken = debtAddr ? findTokenByAddress(debtAddr) : null
        const intAddr = data.interestAssets?.[0]?.asset_address
        const intValue = data.interestAssets?.[0]?.value
        const intToken = intAddr ? findTokenByAddress(intAddr) : null
        const collectionToken = findTokenByAddress(offer.collection_address)
        const isExpanded = expandedId === offer.id
        const deadlineDate = offer.deadline ? new Date(Number(offer.deadline) * 1000) : null
        const isExpired = deadlineDate ? deadlineDate.getTime() < Date.now() : false
        const durationSec = data.duration ? Number(data.duration) : 0

        return (
          <div
            key={offer.id}
            className={`rounded-lg border p-4 transition-colors ${
              isExpanded ? 'border-accent/30 bg-accent/5' : 'border-border/20 bg-surface/5 hover:border-border/40'
            }`}
          >
            {/* Summary row */}
            <button
              type="button"
              onClick={() => { setExpandedId(isExpanded ? null : offer.id); setTokenId('') }}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  {collectionToken ? (
                    <span className="text-xs text-accent font-medium">{collectionToken.symbol}</span>
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">{formatAddress(offer.collection_address)}</span>
                  )}
                </div>
                <span className="text-gray-600 text-xs">|</span>
                <div className="flex items-center gap-1">
                  {debtToken && <TokenAvatar token={debtToken} size={14} />}
                  <span className="text-xs text-white">
                    {debtToken && debtValue ? formatTokenValue(debtValue, debtToken.decimals) : '?'}{' '}
                    {debtToken?.symbol ?? ''}
                  </span>
                </div>
                {intToken && intValue && (
                  <>
                    <span className="text-gray-600 text-xs">+</span>
                    <div className="flex items-center gap-1">
                      <TokenAvatar token={intToken} size={14} />
                      <span className="text-xs text-accent">
                        {formatTokenValue(intValue, intToken.decimals)} {intToken.symbol}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {durationSec > 0 && (
                  <span className="text-[10px] text-gray-400">{formatDurationHuman(durationSec)}</span>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded detail + accept */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-border/15 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-400">Lender</span>
                    <p className="text-white font-mono mt-0.5">{formatAddress(offer.lender)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Collection</span>
                    <p className="text-white font-mono mt-0.5">
                      {collectionToken?.name ?? formatAddress(offer.collection_address)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Duration</span>
                    <p className="text-white mt-0.5">{durationSec > 0 ? formatDurationHuman(durationSec) : '--'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Expires</span>
                    <p className={`mt-0.5 ${isExpired ? 'text-nova' : 'text-white'}`}>
                      {deadlineDate ? deadlineDate.toLocaleDateString() : '--'}
                      {isExpired && ' (expired)'}
                    </p>
                  </div>
                </div>

                {!isExpired && address && (
                  <div className="space-y-3">
                    {/* NFT Picker grid */}
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 block">
                        Select Your NFT
                      </label>
                      <NFTTokenPicker
                        owner={address}
                        collectionAddress={offer.collection_address}
                        onSelect={(id) => setTokenId(id)}
                        selectedTokenId={tokenId}
                      />
                    </div>

                    {/* Manual fallback input */}
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        Or enter Token ID manually
                      </label>
                      <input
                        type="text"
                        placeholder="Token ID (e.g. 1, 42)"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value.trim())}
                        className="w-full mt-1 text-sm font-mono bg-surface/50 border border-border/30 rounded-md px-3 py-2 outline-none text-white placeholder:text-gray-500/40 focus:border-accent/40"
                      />
                    </div>

                    <Button
                      variant="default"
                      className="w-full uppercase tracking-[0.15em] text-xs"
                      onClick={() => handleAccept(offer)}
                      disabled={isAccepting || !tokenId || acceptingId === offer.id}
                    >
                      {acceptingId === offer.id ? (
                        <div className="flex items-center gap-2">
                          <Spinner className="h-3 w-3" />
                          Signing...
                        </div>
                      ) : (
                        'Accept Offer'
                      )}
                    </Button>
                  </div>
                )}

                {!isExpired && !address && (
                  <p className="text-[11px] text-gray-400 text-center py-2">Connect wallet to accept this offer</p>
                )}

                {isExpired && (
                  <p className="text-[11px] text-nova text-center py-2">This offer has expired</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── FAQ Section ──────────────────────────────────────────── */

const SWAP_FAQ = [
  {
    q: 'What is Stela?',
    a: 'Peer-to-peer swaps and lending on StarkNet. No pools, no oracles, no governance. Any ERC20 token, permissionless.',
  },
  {
    q: 'How do swaps work?',
    a: 'Sign an off-chain order or inscribe directly on-chain. A counterparty matches it. A relayer settles both sides atomically. One transaction.',
  },
  {
    q: 'Does creating an order cost gas?',
    a: 'Off-chain orders are gasless — just a wallet signature. On-chain inscriptions cost gas. Both paths settle the same way.',
  },
  {
    q: 'What are the fees?',
    a: '0.15% on swaps (0.05% relayer, 0.10% treasury). 0.25% on lending. 0% on redemption and liquidation. Charged at settlement only.',
  },
  {
    q: 'What tokens can I swap?',
    a: 'Any ERC20 on StarkNet. No listing required. Paste the address, set your terms.',
  },
  {
    q: 'Is there slippage?',
    a: 'No. You set exact amounts. The trade settles at those amounts or not at all.',
  },
  {
    q: 'Can I cancel an order?',
    a: 'Yes. Off-chain orders are cancelled with a gasless signature. On-chain inscriptions are cancelled via a transaction.',
  },
  {
    q: 'What is the Genesis NFT?',
    a: '300 supply, 1,000 STRK mint, max 5 per wallet. Holders get up to 50% off protocol fees. Checked on-chain at settlement. No staking.',
  },
]

const LEND_FAQ = [
  {
    q: 'What is Stela?',
    a: 'Peer-to-peer lending on StarkNet. Fixed terms, isolated risk, no oracles, no variable rates. Permissionless.',
  },
  {
    q: 'How does lending work?',
    a: 'Borrower defines debt, interest, collateral, and duration — off-chain (gasless) or on-chain (inscribed). Lender funds it, receives ERC1155 shares. Collateral locks in a dedicated Locker contract.',
  },
  {
    q: 'What if the borrower defaults?',
    a: 'Anyone can call liquidate() after expiry. Shareholders redeem their ERC1155 for a proportional share of the locked collateral. 0% liquidation fee.',
  },
  {
    q: 'What are ERC1155 shares?',
    a: 'Tradeable proof of your position. Burn them after repayment to claim debt + interest, or after liquidation to claim collateral.',
  },
  {
    q: 'Can multiple lenders fund one loan?',
    a: 'Yes. Each lender funds a portion, each gets shares proportional to their contribution.',
  },
  {
    q: 'What are the fees?',
    a: '0.25% on lending (0.05% relayer, 0.20% treasury). 0.15% on swaps. 0% on redemption and liquidation. Charged at settlement only.',
  },
  {
    q: 'What can be used as collateral?',
    a: 'ERC20, ERC721, ERC1155. Debt and interest must be ERC20. ERC721 collateral restricts the loan to a single lender.',
  },
  {
    q: 'What is the Genesis NFT?',
    a: '300 supply, 1,000 STRK mint, max 5 per wallet. Holders get up to 50% off protocol fees. Checked on-chain at settlement. No staking.',
  },
]

const ADVANCED_FAQ = [
  {
    q: 'What is Advanced mode?',
    a: 'Full multi-asset inscription builder. Combine multiple debt, collateral, and interest assets in a single on-chain or off-chain order. Same protocol, more flexibility.',
  },
  {
    q: 'When should I use Advanced mode?',
    a: 'When you need more than one debt token, mixed collateral (ERC20 + NFT), or want to specify multiple interest assets.',
  },
  {
    q: 'How is it different from Lend/Borrow mode?',
    a: 'Lend mode uses a simple two-box form. Advanced mode exposes the full inscription structure including multi-asset arrays and funding mode selection.',
  },
  {
    q: 'What are the fees?',
    a: '0.25% at settlement (0.05% relayer, 0.20% treasury). 0% to redeem. 0% on liquidation. Genesis NFT holders get up to 50% off.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
      >
        <span className="text-sm text-white group-hover:text-accent transition-colors pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-gray-400 leading-relaxed pb-4 pr-8">{a}</p>
      )}
    </div>
  )
}

function InfoSections({ activeTab }: { activeTab: 'swap' | 'lend' | 'advanced' }) {
  const isSwap = activeTab === 'swap'
  const isAdvanced = activeTab === 'advanced'
  const faq = isSwap ? SWAP_FAQ : isAdvanced ? ADVANCED_FAQ : LEND_FAQ

  return (
    <div className="mt-16 max-w-lg mx-auto">
      {/* Hero statement */}
      <section className="text-center mb-10">
        <p className="text-accent font-mono text-[10px] uppercase tracking-[0.3em] mb-3">
          {isSwap ? 'P2P Swaps on StarkNet' : isAdvanced ? 'Multi-Asset Inscriptions' : 'P2P Lending on StarkNet'}
        </p>
        <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-white leading-[1.15] mb-4">
          {isSwap ? (
            <>Swap anything, <span className="text-accent">peer-to-peer.</span></>
          ) : isAdvanced ? (
            <>If it exists, you can <span className="text-accent">inscribe it.</span></>
          ) : (
            <>If it exists, you can <span className="text-accent">lend it.</span></>
          )}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
          {isSwap
            ? 'Any ERC20, any amount. No pools, no slippage, no oracles. Gasless to create, settled on-chain when matched.'
            : isAdvanced
            ? 'Bundle any combination of ERC20, ERC721, ERC1155 assets into a single inscription. Full control over debt, collateral, and interest arrays.'
            : 'Borrow any ERC20. Collateralize with tokens, NFTs, or vault shares. No listing, no oracles. Every position isolated in its own Locker.'}
        </p>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-12 py-6 border-t border-b border-border/15">
        <div className="text-center">
          <div className="font-bold text-xl text-white">{isSwap ? '0.15%' : '0.25%'}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{isSwap ? 'Swap Fee' : 'Lending Fee'}</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-xl text-white">0%</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Redeem Fee</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-xl text-white">50%</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Max NFT Discount</div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-bold text-lg text-white uppercase tracking-wider mb-1">Questions?</h2>
        <p className="text-gray-400 text-sm mb-6">Answers.</p>
        <div>
          {faq.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-400/60 uppercase tracking-widest">
        <span>Open Source</span>
        <span className="text-gray-600/40">|</span>
        <span>Immutable</span>
        <span className="text-gray-600/40">|</span>
        <span>StarkNet</span>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────── */

type TradeMode = 'swap' | 'lend' | 'advanced'

function TradeContent() {
  const [debtToken] = useQueryState('debtToken', tradeParsers.debtToken)
  const [collateralToken] = useQueryState('collateralToken', tradeParsers.collateralToken)
  const [mode, setMode] = useQueryState('mode', tradeParsers.mode)
  const [, setAmount] = useQueryState('amount', tradeParsers.amount)

  const [offerMode, setOfferMode] = useState<'standard' | 'collection'>('standard')
  const [collectionView, setCollectionView] = useState<'create' | 'browse'>('create')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')

  const { data: orderBookData, isLoading: obLoading } = useOrderBook(
    debtToken ?? '',
    collateralToken ?? '',
  )

  const TAB_LABELS: Record<TradeMode, string> = {
    lend: 'Lend',
    swap: 'Swap',
    advanced: 'Advanced',
  }

  return (
    <div className="animate-fade-up pb-24">
      {/* Trade Form — narrow centered */}
      <div className="max-w-lg mx-auto">
        {/* Tab Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex flex-wrap">
            {(['lend', 'swap', 'advanced'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setOfferMode('standard'); setCollectionView('create') }}
                className={`px-4 sm:px-5 py-2 font-bold text-[13px] uppercase tracking-[0.15em] transition-colors cursor-pointer border-b-2 ${
                  mode === tab
                    ? 'text-accent border-accent'
                    : 'text-gray-400 hover:text-white border-transparent'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Lend mode toggle — Token vs Collection (only shown in lend tab) */}
          {mode === 'lend' && (
            <div className="flex flex-col items-start sm:items-end gap-1">
              <div className="flex gap-1">
                {(['standard', 'collection'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setOfferMode(m); setCollectionView('create') }}
                    className={`py-1 px-2.5 rounded-sm text-[10px] font-medium transition-colors cursor-pointer ${
                      offerMode === m
                        ? 'bg-accent/10 text-accent border border-accent/25'
                        : 'text-gray-400 hover:text-white border border-border/40 hover:border-white/20'
                    }`}
                  >
                    {m === 'standard' ? 'Token' : 'Collection'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-gray-400">
                {offerMode === 'standard'
                  ? 'Lend against a specific token'
                  : 'Lend against any NFT in a collection'}
              </span>
            </div>
          )}
        </div>

        {/* Collection sub-tabs: Create / Browse */}
        {mode === 'lend' && offerMode === 'collection' && (
          <div className="flex gap-1 mb-4">
            {(['create', 'browse'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCollectionView(v)}
                className={`py-1.5 px-3 rounded-sm text-[11px] font-medium transition-colors cursor-pointer ${
                  collectionView === v
                    ? 'bg-green-500/10 text-green-500 border border-green-500/25'
                    : 'text-gray-400 hover:text-white border border-border/40 hover:border-white/20'
                }`}
              >
                {v === 'create' ? 'Create Offer' : 'Browse Offers'}
              </button>
            ))}
          </div>
        )}

        {/* Advanced tab description */}
        {mode === 'advanced' && (
          <p className="text-[11px] text-gray-400 mb-5 leading-relaxed">
            Full multi-asset inscription builder — add multiple debt, collateral, and interest assets in one order.
          </p>
        )}

        {/* Tab content */}
        {mode === 'advanced' ? (
          <AdvancedForm key="advanced" debtToken={debtToken} collateralToken={collateralToken} />
        ) : mode === 'lend' && offerMode === 'collection' ? (
          collectionView === 'create' ? (
            <CollectionOfferForm key="collection-create" />
          ) : (
            <CollectionOfferBrowser key="collection-browse" />
          )
        ) : (
          <TradeForm
            key={`${mode}-${offerMode}`}
            mode={mode === 'swap' ? 'swap' : 'lend'}
            initialDebtToken={debtToken ?? undefined}
            initialCollateralToken={collateralToken ?? undefined}
          />
        )}
      </div>

      {/* Order Book — below form, above info sections */}
      {debtToken && collateralToken && (
        <div className="max-w-lg mx-auto mt-6">
          <OrderBook
            data={orderBookData}
            isLoading={obLoading}
            mode={mode === 'swap' ? 'swap' : 'lending'}
            duration={durationFilter}
            onDurationChange={setDurationFilter}
          />
        </div>
      )}

      {/* Protocol info sections — full width */}
      <InfoSections activeTab={mode} />
    </div>
  )
}

export default function TradePage() {
  return (
    <Suspense>
      <TradeContent />
    </Suspense>
  )
}
