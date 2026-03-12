'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { NETWORK, CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import { useOrderForm } from '@/hooks/useOrderForm'
import { useCollectionOffer } from '@/hooks/useCollectionOffer'
import { useAcceptCollectionOffer } from '@/hooks/useAcceptCollectionOffer'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import type { AssetInputValue } from '@/components/AssetInput'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { NFTCollectionSelector } from '@/components/NFTCollectionSelector'
import type { NFTCollectionInfo } from '@/components/NFTCollectionSelector'
import { TokenAvatar } from '@/components/TokenAvatar'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { formatTokenValue } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { useFeePreview } from '@/hooks/useFeePreview'
import { NFTTokenPicker } from '@/components/NFTTokenPicker'

/* ── Constants ──────────────────────────────────────────── */

const SWAP_DEADLINE_PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '12h', seconds: 43200 },
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '30d', seconds: 2592000 },
]

const LEND_DEADLINE_PRESETS = [
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '60d', seconds: 5184000 },
  { label: '90d', seconds: 7776000 },
]

const DURATION_PRESETS = [
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '90d', seconds: 7776000 },
  { label: '180d', seconds: 15552000 },
  { label: '1y', seconds: 31536000 },
]

function formatDurationHuman(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  const days = Math.round(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''}`
}

function emptyAsset(): AssetInputValue {
  return { asset: '', asset_type: 'ERC20', value: '', token_id: '0', decimals: 18 }
}

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
    <div className={`${bgClass} border ${borderClass} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accentClass}`}>{label}</span>
        {token && balance !== undefined && balance > 0n && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-dust font-mono">
              {formatTokenValue(balance.toString(), token.decimals)}
            </span>
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-[10px] text-star hover:text-star-bright font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTokenClick}
          className="flex items-center gap-2 h-10 px-3 rounded-md bg-surface/60 border border-edge/40 text-sm transition-colors hover:bg-elevated hover:border-edge-bright cursor-pointer shrink-0"
        >
          {token ? (
            <>
              <TokenAvatar token={token} size={20} />
              <span className="text-chalk font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-dust">Select</span>
          )}
          <svg className="text-ash ml-1" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
          className="flex-1 text-right text-xl font-mono bg-transparent outline-none text-chalk placeholder:text-ash/40"
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
        className="w-8 h-8 bg-abyss border border-edge/50 rounded-md flex items-center justify-center hover:border-star/50 transition-colors cursor-pointer"
        aria-label="Swap direction"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dust">
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
        <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Mode</span>
        <div className="flex gap-1">
          {(['offchain', 'onchain'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => form.setMode(m)}
              className={`py-1 px-2.5 rounded-sm text-[10px] font-medium transition-colors cursor-pointer ${
                form.mode === m
                  ? 'bg-star/10 text-star border border-star/25'
                  : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
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
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Duration</span>
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => form.setDurationPreset(p.seconds.toString())}
                className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                  form.durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Expiry */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Expiry</span>
        <div className="flex flex-wrap gap-1">
          {deadlinePresets.map((p) => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => form.setDeadlinePreset(p.seconds.toString())}
              className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                form.deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
              }`}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Funding (lend only) */}
      {isLend && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Funding</span>
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
                    ? 'bg-star/10 text-star border border-star/25'
                    : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
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

/* ── Trade Form ──────────────────────────────────────────── */

function TradeForm({ mode }: { mode: 'swap' | 'lend' }) {
  const isLend = mode === 'lend'
  const form = useOrderForm(isLend ? 'lending' : 'swap')
  const feePreview = useFeePreview(isLend ? 'lending' : 'swap')
  const [openSelector, setOpenSelector] = useState<'give' | 'receive' | 'interest' | null>(null)

  const giveAsset = form.collateralAssets[0] ?? emptyAsset()
  const receiveAsset = form.debtAssets[0] ?? emptyAsset()
  const interestAsset = form.interestAssets[0] ?? emptyAsset()

  const giveToken = giveAsset.asset ? findTokenByAddress(giveAsset.asset) : null

  const giveBalance = giveAsset.asset ? form.balances.get(giveAsset.asset.toLowerCase()) : undefined
  const receiveBalance = receiveAsset.asset ? form.balances.get(receiveAsset.asset.toLowerCase()) : undefined
  const interestBalance = interestAsset.asset ? form.balances.get(interestAsset.asset.toLowerCase()) : undefined

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

  return (
    <>
      {/* ── Token Input Boxes ─────────────────────────────── */}
      <div className="space-y-1">
        <TokenBox
          label={isLend ? "I'll put up" : 'I give'}
          accentClass="text-star"
          borderClass="border-star/20"
          bgClass="bg-star/5"
          asset={giveAsset}
          balance={giveBalance}
          onTokenClick={() => setOpenSelector('give')}
          onAmountChange={(val) => handleAmountChange('give', val)}
          onMaxClick={() => handleMaxClick('give')}
        />

        <DirectionArrow onClick={handleSwapDirection} />

        <TokenBox
          label={isLend ? "I'll borrow" : 'I receive'}
          accentClass="text-aurora"
          borderClass="border-aurora/20"
          bgClass="bg-aurora/5"
          asset={receiveAsset}
          balance={receiveBalance}
          onTokenClick={() => setOpenSelector('receive')}
          onAmountChange={(val) => handleAmountChange('receive', val)}
        />

        {isLend && (
          <div className="pt-1">
            <TokenBox
              label="Interest"
              accentClass="text-nebula"
              borderClass="border-nebula/20"
              bgClass="bg-nebula/5"
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
        <div className="mt-3 px-4 py-3 rounded-lg border border-nova/20 bg-nova/5">
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
          <div className="flex items-center justify-center gap-2 py-3 text-dust text-xs">
            <Spinner className="h-3.5 w-3.5" />
            Checking for matches...
          </div>
        )}

        {/* Match status bar */}
        {hasTokens && showMatches && !form.isChecking && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-star animate-pulse" />
            <span className="text-xs text-star font-bold uppercase tracking-wider">
              {hasFullMatch ? 'Fully Matched' : hasPartialMatch ? `${coverage}% Matched` : 'Matches Available'}
            </span>
            <span className="text-[10px] text-dust">
              {totalMatches} order{totalMatches !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Creation / settings box — shown when no full match */}
        {hasTokens && !hasFullMatch && !form.isChecking && (
          <div className={`rounded-lg border p-4 space-y-3 ${
            hasPartialMatch ? 'border-star/20 bg-star/5' : 'border-edge/30 bg-surface/5'
          }`}>
            {hasPartialMatch ? (
              <p className="text-xs text-dust">
                Fill the matched {coverage}% and create an order for the remainder.
              </p>
            ) : showMatches ? (
              <p className="text-xs text-dust">
                Enter amounts to fill existing orders, or configure and create a new Stela.
              </p>
            ) : (
              <div>
                <p className="text-xs text-chalk font-medium">No matches found</p>
                <p className="text-[11px] text-dust mt-0.5">
                  Create a Stela to broadcast your order to the network.
                </p>
              </div>
            )}
            <OrderSettings form={form} isLend={isLend} deadlinePresets={deadlinePresets} />
          </div>
        )}

        {/* Submit button */}
        {hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to trade" centered={false}>
            <Button
              variant="gold"
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

        {/* Info strip */}
        {hasTokens && !form.isChecking && (
          <div className="flex items-center justify-center gap-3 text-[11px] text-ash">
            {!hasFullMatch && (
              <>
                <span className={form.mode === 'offchain' ? 'text-aurora' : 'text-star'}>
                  {form.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
                </span>
                <span className="text-edge">·</span>
              </>
            )}
            <span className={feePreview.savingsBps > 0 ? 'text-aurora' : ''}>
              {feeText} fee
              {feePreview.savingsBps > 0 && <span className="text-ash ml-0.5">(-{feePreview.discountPercent}%)</span>}
            </span>
            {isLend && !hasFullMatch && (
              <>
                <span className="text-edge">·</span>
                <span>{formatDurationHuman(Number(form.duration))}</span>
              </>
            )}
            {form.roiInfo && (
              <>
                <span className="text-edge">·</span>
                <span className="text-aurora font-medium">+{form.roiInfo.yieldPct}%</span>
              </>
            )}
          </div>
        )}

        {/* Not ready — no tokens */}
        {!hasTokens && (
          <Web3ActionWrapper message="Connect your wallet to trade" centered={false}>
            <Button variant="gold" className="w-full uppercase tracking-wider" disabled>
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
    </>
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
        <div className="bg-star/5 border border-star/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-star">Collection</span>
          </div>
          <button
            type="button"
            onClick={() => setCollectionSelectorOpen(true)}
            className="w-full flex items-center gap-3 py-2 px-1 rounded-lg transition-colors text-left hover:bg-star/5"
          >
            {selectedCollection ? (
              <>
                <div className="relative shrink-0 rounded-lg overflow-hidden bg-edge/20" style={{ width: 40, height: 40 }}>
                  {selectedCollection.image ? (
                    <img
                      src={selectedCollection.image}
                      alt={selectedCollection.name}
                      width={40}
                      height={40}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dust text-sm font-semibold">
                      {selectedCollection.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-chalk truncate">{selectedCollection.name}</div>
                  <div className="text-[10px] text-dust font-mono truncate">{formatAddress(selectedCollection.address)}</div>
                </div>
              </>
            ) : (
              <>
                <div className="shrink-0 w-10 h-10 rounded-lg border border-dashed border-edge flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                    <path d="M6 6h4M6 10h4" />
                  </svg>
                </div>
                <span className="text-sm text-ash/60">Select Collection</span>
              </>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-dust ml-auto">
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
          accentClass="text-aurora"
          borderClass="border-aurora/20"
          bgClass="bg-aurora/5"
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
            accentClass="text-nebula"
            borderClass="border-nebula/20"
            bgClass="bg-nebula/5"
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
        <div className="mt-3 px-4 py-3 rounded-lg border border-nova/20 bg-nova/5">
          <p className="text-xs text-nova font-medium">
            {!isValidAddress && '• Enter a valid collection address. '}
            {!hasDebt && '• Select a token and amount to lend.'}
          </p>
        </div>
      )}

      {/* Settings */}
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-edge/30 bg-surface/5 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Duration</span>
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setDurationPreset(p.seconds.toString())}
                  className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                    durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">Expiry</span>
            <div className="flex flex-wrap gap-1">
              {LEND_DEADLINE_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setDeadlinePreset(p.seconds.toString())}
                  className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
                    deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <Web3ActionWrapper message="Connect your wallet to create a collection offer" centered={false}>
          <Button
            variant="gold"
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
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ash">
          <span className="text-aurora">Gasless</span>
          <span className="text-edge">·</span>
          <span className={feePreview.savingsBps > 0 ? 'text-aurora' : ''}>
            {feeText} fee
            {feePreview.savingsBps > 0 && <span className="text-ash ml-0.5">(-{feePreview.discountPercent}%)</span>}
          </span>
          <span className="text-edge">·</span>
          <span>{formatDurationHuman(Number(durationPreset))}</span>
          <span className="text-edge">·</span>
          <span className="text-dust">Any NFT in collection</span>
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

  // Listen for sync events to refresh
  useEffect(() => {
    const handler = () => fetchOffers()
    window.addEventListener('stela:sync', handler)
    return () => window.removeEventListener('stela:sync', handler)
  }, [fetchOffers])

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
      <div className="flex items-center justify-center gap-2 py-8 text-dust text-xs">
        <Spinner className="h-3.5 w-3.5" />
        Loading collection offers...
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-dust">No open collection offers</p>
        <p className="text-[11px] text-ash mt-1">Collection offers from lenders will appear here.</p>
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
              isExpanded ? 'border-star/30 bg-star/5' : 'border-edge/20 bg-surface/5 hover:border-edge/40'
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
                    <span className="text-xs text-star font-medium">{collectionToken.symbol}</span>
                  ) : (
                    <span className="text-xs text-dust font-mono">{formatAddress(offer.collection_address)}</span>
                  )}
                </div>
                <span className="text-edge text-xs">|</span>
                <div className="flex items-center gap-1">
                  {debtToken && <TokenAvatar token={debtToken} size={14} />}
                  <span className="text-xs text-chalk">
                    {debtToken && debtValue ? formatTokenValue(debtValue, debtToken.decimals) : '?'}{' '}
                    {debtToken?.symbol ?? ''}
                  </span>
                </div>
                {intToken && intValue && (
                  <>
                    <span className="text-edge text-xs">+</span>
                    <div className="flex items-center gap-1">
                      <TokenAvatar token={intToken} size={14} />
                      <span className="text-xs text-nebula">
                        {formatTokenValue(intValue, intToken.decimals)} {intToken.symbol}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {durationSec > 0 && (
                  <span className="text-[10px] text-dust">{formatDurationHuman(durationSec)}</span>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-dust transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded detail + accept */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-edge/15 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-dust">Lender</span>
                    <p className="text-chalk font-mono mt-0.5">{formatAddress(offer.lender)}</p>
                  </div>
                  <div>
                    <span className="text-dust">Collection</span>
                    <p className="text-chalk font-mono mt-0.5">
                      {collectionToken?.name ?? formatAddress(offer.collection_address)}
                    </p>
                  </div>
                  <div>
                    <span className="text-dust">Duration</span>
                    <p className="text-chalk mt-0.5">{durationSec > 0 ? formatDurationHuman(durationSec) : '--'}</p>
                  </div>
                  <div>
                    <span className="text-dust">Expires</span>
                    <p className={`mt-0.5 ${isExpired ? 'text-nova' : 'text-chalk'}`}>
                      {deadlineDate ? deadlineDate.toLocaleDateString() : '--'}
                      {isExpired && ' (expired)'}
                    </p>
                  </div>
                </div>

                {!isExpired && address && (
                  <div className="space-y-3">
                    {/* NFT Picker grid */}
                    <div>
                      <label className="text-[10px] text-dust uppercase tracking-widest font-bold mb-2 block">
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
                      <label className="text-[10px] text-dust uppercase tracking-widest font-bold">
                        Or enter Token ID manually
                      </label>
                      <input
                        type="text"
                        placeholder="Token ID (e.g. 1, 42)"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value.trim())}
                        className="w-full mt-1 text-sm font-mono bg-abyss/50 border border-edge/30 rounded-md px-3 py-2 outline-none text-chalk placeholder:text-ash/40 focus:border-star/40"
                      />
                    </div>

                    <Button
                      variant="gold"
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
                  <p className="text-[11px] text-dust text-center py-2">Connect wallet to accept this offer</p>
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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-edge/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
      >
        <span className="text-sm text-chalk group-hover:text-star transition-colors pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-dust shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-dust leading-relaxed pb-4 pr-8">{a}</p>
      )}
    </div>
  )
}

function InfoSections({ activeTab }: { activeTab: 'swap' | 'lend' }) {
  const isLend = activeTab === 'lend'
  const faq = isLend ? LEND_FAQ : SWAP_FAQ

  return (
    <div className="mt-16 max-w-lg mx-auto">
      {/* Hero statement */}
      <section className="text-center mb-10">
        <p className="text-star font-mono text-[10px] uppercase tracking-[0.3em] mb-3">
          {isLend ? 'P2P Lending on StarkNet' : 'P2P Swaps on StarkNet'}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-chalk leading-[1.15] mb-4">
          {isLend ? (
            <>If it exists, you can <span className="text-star">lend it.</span></>
          ) : (
            <>Swap anything, <span className="text-star">peer-to-peer.</span></>
          )}
        </h2>
        <p className="text-dust text-sm leading-relaxed max-w-md mx-auto">
          {isLend
            ? 'Borrow any ERC20. Collateralize with tokens, NFTs, or vault shares. No listing, no oracles. Every position isolated in its own Locker.'
            : 'Any ERC20, any amount. No pools, no slippage, no oracles. Gasless to create, settled on-chain when matched.'}
        </p>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-12 py-6 border-t border-b border-edge/15">
        <div className="text-center">
          <div className="font-display text-xl text-chalk">{isLend ? '0.25%' : '0.15%'}</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">{isLend ? 'Lending Fee' : 'Swap Fee'}</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">0%</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Redeem Fee</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">50%</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Max NFT Discount</div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-display text-lg text-chalk uppercase tracking-wider mb-1">Questions?</h2>
        <p className="text-dust text-sm mb-6">Answers.</p>
        <div>
          {faq.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-dust/60 uppercase tracking-widest">
        <span>Open Source</span>
        <span className="text-edge/40">|</span>
        <span>Immutable</span>
        <span className="text-edge/40">|</span>
        <span>StarkNet</span>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────── */

function TradeContent() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'swap' ? 'swap' : 'lend'
  const [activeTab, setActiveTab] = useState<'swap' | 'lend'>(initialMode as 'swap' | 'lend')
  const [offerMode, setOfferMode] = useState<'standard' | 'collection'>('standard')
  const [collectionView, setCollectionView] = useState<'create' | 'browse'>('create')

  return (
    <div className="animate-fade-up pb-24">
      {/* Trade Form — narrow centered */}
      <div className="max-w-lg mx-auto">
        {/* Tab Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex">
            {(['swap', 'lend'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setOfferMode('standard'); setCollectionView('create') }}
                className={`px-5 py-2 font-display text-[13px] uppercase tracking-[0.15em] transition-colors cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? 'text-star border-star'
                    : 'text-dust hover:text-chalk border-transparent'
                }`}
              >
                {tab === 'swap' ? 'Swap' : 'Lend'}
              </button>
            ))}
          </div>

          {/* Lend mode toggle — Token vs Collection */}
          {activeTab === 'lend' && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                {(['standard', 'collection'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setOfferMode(m); setCollectionView('create') }}
                    className={`py-1 px-2.5 rounded-sm text-[10px] font-medium transition-colors cursor-pointer ${
                      offerMode === m
                        ? 'bg-star/10 text-star border border-star/25'
                        : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
                    }`}
                  >
                    {m === 'standard' ? 'Token' : 'Collection'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-dust">
                {offerMode === 'standard'
                  ? 'Lend against a specific token'
                  : 'Lend against any NFT in a collection'}
              </span>
            </div>
          )}
        </div>

        {/* Collection sub-tabs: Create / Browse */}
        {activeTab === 'lend' && offerMode === 'collection' && (
          <div className="flex gap-1 mb-4">
            {(['create', 'browse'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCollectionView(v)}
                className={`py-1.5 px-3 rounded-sm text-[11px] font-medium transition-colors cursor-pointer ${
                  collectionView === v
                    ? 'bg-aurora/10 text-aurora border border-aurora/25'
                    : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
                }`}
              >
                {v === 'create' ? 'Create Offer' : 'Browse Offers'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'lend' && offerMode === 'collection' ? (
          collectionView === 'create' ? (
            <CollectionOfferForm key="collection-create" />
          ) : (
            <CollectionOfferBrowser key="collection-browse" />
          )
        ) : (
          <TradeForm key={`${activeTab}-${offerMode}`} mode={activeTab} />
        )}
      </div>

      {/* Protocol info sections — full width */}
      <InfoSections activeTab={activeTab} />
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
