'use client'

import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

/* ── Home Helpers ─────────────────────────────────────────── */

function Numeral({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-6xl sm:text-7xl lg:text-8xl text-star/10 select-none leading-none" aria-hidden="true">
      {children}
    </span>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center min-w-[100px]">
      <div className="font-display text-2xl sm:text-3xl text-chalk tracking-tight">{value}</div>
      <div className="text-[11px] text-dust uppercase tracking-[0.2em] mt-1">{label}</div>
    </div>
  )
}

const icon = {
  handshake: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 11.5L14 18l-3-3-5 5" /><path d="M20.5 16.5v-5h-5" /><path d="M3.5 7.5L10 1l3 3 5-5" /><path d="M3.5 2.5v5h5" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  code: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  lock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  chain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  hourglass: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22" /><path d="M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" />
    </svg>
  ),
  split: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 00-1.172-2.872L3 3" /><path d="M15.828 10.828L21 3" />
    </svg>
  ),
  signature: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17c1.5-3 3-5 4.5-5s2 2 3.5 2 2.5-3 4-3 2.5 4 4 4 2-2 4-6" /><path d="M2 21h20" />
    </svg>
  ),
  vault: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="12" cy="12" r="4" /><path d="M12 8v8" /><path d="M8 12h8" />
    </svg>
  ),
  relay: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  gem: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3l1 10" /><path d="M2 9h20" /><path d="M6.5 3L12 13" /><path d="M17.5 3L12 13" />
    </svg>
  ),
  receipt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 10h8" /><path d="M8 14h4" />
    </svg>
  ),
}

/* ── Info Sections ───────────────────────────────────────── */

function InfoSections({ activeTab, onSwitchTab }: { activeTab: 'swap' | 'lend'; onSwitchTab: (tab: 'swap' | 'lend') => void }) {
  const isLend = activeTab === 'lend'

  return (
    <div className="mt-20">
      {/* ── Contextual Intro ─────────────────────────────── */}
      <section className="text-center mb-16">
        <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">
          {isLend ? 'P2P Lending on StarkNet' : 'P2P Swaps on StarkNet'}
        </p>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-chalk leading-[1.1] mb-6">
          {isLend ? (
            <>If it exists,<br />you can <span className="text-star">lend it.</span></>
          ) : (
            <>Swap anything,<br /><span className="text-star">peer-to-peer.</span></>
          )}
        </h2>
        <p className="text-dust text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          {isLend
            ? 'Any ERC20, ERC721, ERC1155, or ERC4626 — borrowable, lendable, day one. No listing required, no oracles, no governance vote. Every position is isolated. Multi-lender funding turns any loan into a permissionless vault with tradeable shares.'
            : 'Any token pair, any amount. No liquidity pools, no slippage, no oracle dependency. Your order sits until matched — or gets filled instantly if a counterpart exists. Gasless off-chain signatures mean zero cost to create.'}
        </p>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <section className="border-t border-b border-edge/15 py-6 mb-16">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 sm:gap-12">
          <Stat value={isLend ? '0.25%' : '0.15%'} label={isLend ? 'Lending Fee' : 'Swap Fee'} />
          <Stat value="0%" label="Redemption Fee" />
          <Stat value="0%" label="Liquidation Fee" />
          <Stat value="50%" label="Max NFT Discount" />
        </div>
      </section>

      {/* ── Three Pillars ────────────────────────────────── */}
      <section className="mb-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Why Stela</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight mb-16 max-w-xl">
            {isLend ? 'The mother of exotic lending' : 'Trade without pools'}
          </h2>

          <div className="grid lg:grid-cols-3 gap-px bg-edge/20 rounded-lg overflow-hidden">
            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-star/10 flex items-center justify-center text-star mb-6 group-hover:scale-110 transition-transform">
                {icon.gem}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">Asset-Agnostic</h3>
              <p className="text-dust text-sm leading-relaxed">
                {isLend
                  ? 'ERC20, ERC721, ERC1155, ERC4626 — all supported day one. No listing proposals, no oracle feeds, no governance votes. If it exists on-chain, you can lend it.'
                  : 'Swap any ERC20, ERC721, ERC1155, or ERC4626 token. No listing proposals, no oracle feeds. If it exists on-chain, you can trade it.'}
              </p>
            </div>

            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora mb-6 group-hover:scale-110 transition-transform">
                {icon.vault}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">
                {isLend ? 'Permissionless Vaults' : 'Direct Settlement'}
              </h3>
              <p className="text-dust text-sm leading-relaxed">
                {isLend
                  ? 'Multi-lender funding turns any loan into a vault. Multiple lenders fill portions, each receiving tradeable ERC1155 shares. No pool manager, no whitelists.'
                  : 'No AMM, no liquidity pools, no impermanent loss. Your swap is matched directly with a counterparty. One wallet popup via StarkNet multicall.'}
              </p>
            </div>

            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-nebula/10 flex items-center justify-center text-nebula mb-6 group-hover:scale-110 transition-transform">
                {icon.split}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">Isolated Risk</h3>
              <p className="text-dust text-sm leading-relaxed">
                {isLend
                  ? 'Every loan deploys its own Locker contract. Your collateral is never pooled. One bad position can never cascade into another. Zero contagion by design.'
                  : 'Every trade is independent. No shared pool risk, no cascading liquidations. Your assets are only exposed to your specific trade.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pool vs P2P Comparison ────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-edge/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Why P2P?</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight mb-16 max-w-xl">
            {isLend ? 'Pool-based vs peer-to-peer' : 'AMMs vs peer-to-peer'}
          </h2>

          <div className="grid md:grid-cols-2 gap-px bg-edge/20 rounded-lg overflow-hidden">
            <div className="bg-abyss/60 p-6 sm:p-8 border-b border-edge/20">
              <h3 className="font-display text-sm text-dust uppercase tracking-widest">
                {isLend ? 'Pool-Based Lending' : 'AMM / DEX'}
              </h3>
              <p className="text-dust/60 text-xs mt-1">{isLend ? 'Nostra, Vesu, zkLend' : 'Ekubo, JediSwap, 10KSwap'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8 border-b border-edge/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-star/[0.06] rounded-full blur-[50px] pointer-events-none" />
              <h3 className="font-display text-sm text-star uppercase tracking-widest relative z-10">Stela P2P</h3>
              <p className="text-dust/60 text-xs mt-1 relative z-10">First on StarkNet</p>
            </div>

            <div className="bg-abyss/60 p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">Supported Assets</span>
              <p className="text-dust/80 text-sm leading-relaxed">{isLend ? 'Governance-approved ERC20 only' : 'Whitelisted token pairs only'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">Supported Assets</span>
              <p className="text-star text-sm leading-relaxed">Any ERC20, ERC721, ERC1155, ERC4626</p>
            </div>

            <div className="bg-abyss/60 p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">{isLend ? 'New Asset Listing' : 'New Pair'}</span>
              <p className="text-dust/80 text-sm leading-relaxed">{isLend ? 'Governance vote, oracle setup, weeks' : 'Liquidity provisioning, pair creation'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">{isLend ? 'New Asset Listing' : 'New Pair'}</span>
              <p className="text-chalk text-sm leading-relaxed">Instant — just create an order</p>
            </div>

            <div className="bg-abyss/60 p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">{isLend ? 'Interest Rates' : 'Pricing'}</span>
              <p className="text-dust/80 text-sm leading-relaxed">{isLend ? 'Variable, changes hourly' : 'Curve-based, slippage dependent'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">{isLend ? 'Interest Rates' : 'Pricing'}</span>
              <p className="text-chalk text-sm leading-relaxed">{isLend ? 'Fixed, set at creation' : 'Fixed, set by counterparties'}</p>
            </div>

            <div className="bg-abyss/60 p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">Risk</span>
              <p className="text-dust/80 text-sm leading-relaxed">{isLend ? 'Shared pool — one bad asset affects all' : 'Impermanent loss, pool exploits'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8 border-b border-edge/10">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">Risk</span>
              <p className="text-chalk text-sm leading-relaxed">{isLend ? 'Isolated per-loan Locker contract' : 'No pool risk, direct P2P settlement'}</p>
            </div>

            <div className="bg-abyss/60 p-6 sm:p-8">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">UX</span>
              <p className="text-dust/80 text-sm leading-relaxed">{isLend ? '2-step approve then transact (EVM)' : 'Approve, swap, slippage settings'}</p>
            </div>
            <div className="bg-abyss p-6 sm:p-8">
              <span className="text-dust text-xs uppercase tracking-widest block mb-2">UX</span>
              <p className="text-star text-sm leading-relaxed">One wallet popup (StarkNet multicall)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Lifecycle ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-edge/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20">
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight max-w-lg mb-4">
              {isLend ? 'Four steps, fully on-chain' : 'Two steps, fully settled'}
            </h2>
            <p className="text-dust text-sm leading-relaxed max-w-xl">
              {isLend
                ? 'Every lending position follows the same clear lifecycle. From inscription to redemption, each step is transparent and verifiable.'
                : 'Create an order and wait for a match — or fill an existing one instantly. Every trade is settled on-chain.'}
            </p>
          </div>

          {isLend ? (
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16 lg:gap-y-20">
              <div className="flex items-center gap-6">
                <Numeral>I</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Inscribe</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    Define your terms: debt, interest, collateral, and duration.
                    Your collateral is locked in a dedicated Locker contract — isolated from everyone else.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Numeral>II</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Fund</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    A lender provides the debt assets and receives ERC1155 shares as proof of their claim.
                    The borrower gets their liquidity instantly.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Numeral>III</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Repay</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    Return the debt plus interest before the duration expires.
                    Collateral is released. If time runs out, lenders claim the collateral.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Numeral>IV</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Redeem</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    After repayment or liquidation, shareholders burn their ERC1155 tokens
                    for a proportional share of the underlying assets.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16 lg:gap-y-20">
              <div className="flex items-center gap-6">
                <Numeral>I</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Create or Match</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    Select your tokens and amounts. If a matching order exists, fill it instantly.
                    Otherwise, sign a gasless off-chain order and wait for a counterparty.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Numeral>II</Numeral>
                <div>
                  <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Settle</h3>
                  <p className="text-dust text-sm leading-relaxed">
                    When matched, the relayer settles both sides atomically on-chain.
                    One transaction, one wallet popup. Assets exchange hands directly.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Gasless + Fees ────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-edge/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 lg:gap-16">
          <div className="lg:col-span-3">
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Off-Chain Signatures</p>
            <h2 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight mb-6">
              Create orders for free
            </h2>
            <p className="text-dust text-sm leading-relaxed mb-10 max-w-lg">
              {isLend
                ? 'Sign SNIP-12 typed data with your wallet — no gas, no on-chain transaction. When a lender matches your order, a relayer bot settles it on-chain automatically.'
                : 'Sign SNIP-12 typed data with your wallet — no gas, no on-chain transaction. When a counterparty matches your swap, settlement happens automatically.'}
            </p>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star flex-shrink-0 mt-0.5">
                  {icon.signature}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Sign, Don&apos;t Transact</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    Your signed intent is stored off-chain until {isLend ? 'a lender' : 'a counterparty'} matches it.
                    Cancel anytime with another signature.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora flex-shrink-0 mt-0.5">
                  {icon.relay}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Permissionless Relayers</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    Anyone can call <span className="font-mono text-xs text-star">settle()</span> and
                    earn 0.05% per trade. No whitelist needed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-abyss/60 border border-edge/30 rounded-lg p-6 sm:p-8 granite-noise relative overflow-hidden h-full">
              <div className="absolute inset-0 bg-gradient-to-b from-star/[0.02] to-transparent pointer-events-none" />
              <div className="relative z-10">
                <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-6">Protocol Fees</p>
                <div className="space-y-5 mb-8">
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Settlement</span>
                    <span className="font-display text-xl text-chalk">0.25<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Swap</span>
                    <span className="font-display text-xl text-chalk">0.15<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Redemption</span>
                    <span className="font-display text-xl text-chalk">0<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Liquidation</span>
                    <span className="font-display text-xl text-chalk">0<span className="text-sm text-dust">%</span></span>
                  </div>
                </div>
                <div className="bg-void/60 rounded-lg p-5 border border-edge/15">
                  <div className="font-display text-2xl text-star mb-1">{isLend ? '0.25%' : '0.15%'}</div>
                  <p className="text-dust text-xs leading-relaxed">
                    {isLend
                      ? 'Max lending fee. Swaps just 0.15%. No redeem or liquidation fees. Genesis NFT holders pay up to 50% less.'
                      : 'Swap fee. Lending at 0.25%. No redeem or liquidation fees. Genesis NFT holders pay up to 50% less.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Genesis NFT ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-edge/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="bg-star/[0.03] border border-star/15 rounded-lg p-8 sm:p-10 relative overflow-hidden granite-noise">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-star/[0.06] rounded-full blur-[70px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-xl bg-star/10 border border-star/25 flex items-center justify-center text-star">
                  {icon.gem}
                </div>
                <div>
                  <h3 className="font-display text-xl text-star uppercase tracking-wider">Genesis NFT</h3>
                  <p className="text-[10px] text-dust uppercase tracking-widest">ERC721 on StarkNet</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Supply</span>
                  <span className="text-chalk font-display text-lg tracking-wider">300</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Mint Price</span>
                  <span className="text-star font-display text-lg tracking-wider">1,000 STRK</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Max Per Wallet</span>
                  <span className="text-chalk font-display text-lg tracking-wider">5</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Max Discount</span>
                  <span className="text-star font-display text-lg tracking-wider">50%</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-dust text-sm">Staking Required</span>
                  <span className="text-aurora text-sm tracking-wider">No</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Genesis Collection</p>
            <h2 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight mb-6">
              Hold the NFT, pay less fees
            </h2>
            <p className="text-dust leading-relaxed mb-8">
              Genesis holders get automatic fee discounts — checked on-chain at transaction time.
              No staking, no claiming, no lock-up. Sell the NFT and the discount transfers
              to the new owner.
            </p>
            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-cosmic/10 flex items-center justify-center text-cosmic flex-shrink-0 mt-0.5">
                  {icon.receipt}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Discount Model</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    15% base discount with 1+ NFT. Additional bonuses for volume tiers
                    and multi-NFT holdings, capped at 50%.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-ember/10 flex items-center justify-center text-ember flex-shrink-0 mt-0.5">
                  {icon.vault}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Transparent Treasury</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    50 NFTs minted to treasury on deploy — hardcoded in the constructor.
                    Ownership renounced after launch. Fully immutable.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <Button asChild variant="outline" className="border-star/30 hover:border-star hover:bg-star/5 text-star px-6 h-11 rounded-full transition-all cursor-pointer">
                <Link href="/nft">Mint Genesis NFT</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Signals ──────────────────────────────────── */}
      <section className="py-12 sm:py-16 border-t border-edge/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 lg:gap-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star">{icon.shield}</div>
              <span className="text-dust text-sm">Security Audited</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star">{icon.code}</div>
              <span className="text-dust text-sm">Open Source</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star">{icon.lock}</div>
              <span className="text-dust text-sm">Immutable Contracts</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star">{icon.chain}</div>
              <span className="text-dust text-sm">Built on StarkNet</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star">{icon.check}</div>
              <span className="text-dust text-sm">Ownership Renounced</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-20 text-center border-t border-edge/10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-star/[0.07] rounded-full blur-[100px] -z-10" />
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-star/40 to-transparent mx-auto mb-10" />
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-chalk tracking-tight mb-6">
          {isLend ? 'Ready to lend the unlendable?' : 'Ready to swap anything?'}
        </h2>
        <p className="text-dust mb-10 max-w-md mx-auto leading-relaxed">
          {isLend
            ? 'Borrow against any asset. Fund loans and earn tradeable shares. No listing required — just create an order.'
            : 'Swap any token peer-to-peer. No pools, no slippage. Create a gasless order or fill one instantly.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-star hover:bg-star-bright text-void font-semibold px-12 h-14 rounded-full text-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            onClick={() => { onSwitchTab(isLend ? 'lend' : 'swap'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          >
            {isLend ? 'Start Lending' : 'Start Swapping'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-edge hover:border-star/30 hover:bg-surface text-chalk px-12 h-14 rounded-full text-lg transition-all cursor-pointer"
            onClick={() => { onSwitchTab(isLend ? 'swap' : 'lend'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          >
            {isLend ? 'Try Swapping' : 'Try Lending'}
          </Button>
          <Button asChild variant="outline" size="lg" className="border-edge hover:border-edge-bright hover:bg-surface text-dust hover:text-chalk px-12 h-14 rounded-full text-lg transition-all cursor-pointer">
            <Link href="/markets">Browse Markets</Link>
          </Button>
        </div>
      </section>
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
      <InfoSections activeTab={activeTab} onSwitchTab={setActiveTab} />
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
