'use client'

import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { useOrderForm } from '@/hooks/useOrderForm'
import type { AssetInputValue } from '@/components/AssetInput'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar } from '@/components/TokenAvatar'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { formatTokenValue } from '@/lib/format'

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
  const feeText = isLend ? '0.25%' : '0.15%'

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
          <Web3ActionWrapper message="Connect your wallet to trade">
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
            <span>{feeText} fee</span>
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
          <Web3ActionWrapper message="Connect your wallet to trade">
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

/* ── FAQ Section ──────────────────────────────────────────── */

const SWAP_FAQ = [
  {
    q: 'What is Stela?',
    a: 'Peer-to-peer swaps and lending on StarkNet. No pools, no oracles, no governance. Any ERC20 token, permissionless.',
  },
  {
    q: 'How do swaps work?',
    a: 'Sign an off-chain order. A counterparty matches it. A relayer settles both sides atomically on-chain. One transaction.',
  },
  {
    q: 'Does creating an order cost gas?',
    a: 'No. Orders are off-chain SNIP-12 signatures. Gas is only paid at settlement.',
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
    a: 'Yes. Sign a cancellation — also gasless. The order is cancelled and can no longer be settled.',
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
    a: 'Borrower defines debt, interest, collateral, and duration. Lender funds it, receives ERC1155 shares. Collateral locks in a dedicated Locker contract.',
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
      <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-12 py-6 border-t border-b border-edge/15">
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
        <span>Audited</span>
        <span className="text-edge/40">|</span>
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
  const initialMode = searchParams.get('mode') === 'lend' ? 'lend' : 'swap'
  const [activeTab, setActiveTab] = useState<'swap' | 'lend'>(initialMode as 'swap' | 'lend')

  return (
    <div className="animate-fade-up pb-24">
      {/* Trade Form — narrow centered */}
      <div className="max-w-lg mx-auto">
        {/* Tab Bar */}
        <div className="flex items-center mb-6">
          <div className="flex">
            {(['swap', 'lend'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
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
        </div>

        <TradeForm key={activeTab} mode={activeTab} />
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
