'use client'

import { useState } from 'react'
import { useOrderForm } from '@/hooks/useOrderForm'
import type { AssetRole } from '@/hooks/useOrderForm'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { formatTimestamp } from '@/lib/format'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { InlineMatchList } from '@/components/InlineMatchList'
import { AssetRow } from '@/app/borrow/components/AssetRow'
import { AddAssetModal } from '@/app/borrow/components/AddAssetModal'
import { InlineBorrowForm } from '@/app/borrow/components/InlineBorrowForm'

/* ── Constants ──────────────────────────────────────────── */

const SWAP_ROLES: AssetRole[] = ['debt', 'collateral']

const DEADLINE_PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '12h', seconds: 43200 },
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '30d', seconds: 2592000 },
]

/* ════════════════════════════════════════════════════════════
   SWAP PAGE — Atomic swaps only
   ════════════════════════════════════════════════════════════ */

export default function SwapPage() {
  const form = useOrderForm('swap')
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="animate-fade-up pb-24 relative max-w-3xl mx-auto">

      {/* ── Ambient Background ───────────────────────────── */}
      <div className="hidden sm:fixed sm:block top-1/4 -left-20 w-64 h-64 bg-nebula/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="hidden sm:fixed sm:block bottom-1/4 -right-20 w-64 h-64 bg-aurora/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* ── Header ────────── */}
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Swap
        </h1>
        <p className="text-dust max-w-lg mx-auto leading-relaxed mb-6">
          Swap any ERC20 peer-to-peer with no slippage, no liquidity pools, no impermanent loss. Set your price and wait for a match.
        </p>

        {/* Reset button */}
        <button
          type="button"
          onClick={form.resetForm}
          className="text-ash hover:text-nova text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* ── Inline Swap Form (2 sections: I give / I receive) */}
      <div className="mb-8">
        <InlineBorrowForm
          orderType="swap"
          debtAssets={form.debtAssets}
          collateralAssets={form.collateralAssets}
          interestAssets={form.interestAssets}
          onDebtChange={form.setDebtAssets}
          onCollateralChange={form.setCollateralAssets}
          onInterestChange={form.setInterestAssets}
          balances={form.balances}
        />
      </div>

      {/* ── Order Expiry ──────────────────────────────────── */}
      <section className="rounded-xl border border-edge/30 bg-surface/5 overflow-clip mb-8 max-w-xl mx-auto">
        <div className="px-4 py-2.5 border-b border-edge/30 bg-surface/10">
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Order Expiry</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {DEADLINE_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => form.setDeadlinePreset(p.seconds.toString())}
                className={`py-2 px-4 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                  form.deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star shadow-[0_0_10px_rgba(232,168,37,0.1)]' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                }`}
              >{p.label}</button>
            ))}
          </div>
          <p className="text-[10px] text-dust" suppressHydrationWarning>
            Expires {formatTimestamp(BigInt(form.deadline))}
          </p>
        </div>
      </section>

      {/* ── Advanced Options (collapsible) ─────────────────── */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-[11px] text-dust hover:text-chalk uppercase tracking-widest font-bold transition-colors cursor-pointer group"
        >
          <svg
            className={`w-3 h-3 text-ash group-hover:text-chalk transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          Advanced Options
          {form.allAssets.length > 0 && <span className="text-star">({form.allAssets.length} assets)</span>}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-fade-up">
            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-ash uppercase tracking-widest font-bold whitespace-nowrap">Mode</span>
              <div className="flex gap-1">
                {(['offchain', 'onchain'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => form.setMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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

            {/* Asset Table */}
            <section className="rounded-xl border border-edge/30 overflow-clip bg-surface/5">
              <div className="flex items-center justify-between px-4 py-3 border-b border-edge/30 bg-surface/10">
                <span className="text-[11px] text-dust uppercase tracking-widest font-bold">
                  Swap Assets
                  {form.allAssets.length > 0 && <span className="ml-2 text-star">({form.allAssets.length})</span>}
                </span>
                <button
                  type="button"
                  onClick={() => form.setAddModalOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-star hover:text-star-bright transition-colors font-medium cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
                  Add Asset
                </button>
              </div>

              <div className="hidden md:flex items-center px-4 py-2 text-[10px] text-dust uppercase tracking-widest font-bold border-b border-edge/20 bg-void/30">
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
                  <div className="w-10 h-10 rounded-xl bg-surface/30 border border-edge/50 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash"><path d="M8 3v10M3 8h10" /></svg>
                  </div>
                  <p className="text-xs text-dust">Add extra assets via the modal for multi-asset swaps</p>
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
        <div className="mb-8 px-4 py-3 rounded-xl border border-nova/20 bg-nova/5 max-w-xl mx-auto">
          <p className="text-xs text-nova font-medium">
            {!form.hasDebt && '• Add the token you want to receive. '}
            {!form.hasCollateral && '• Add the token you want to give.'}
          </p>
        </div>
      )}

      {/* ── Agreement Summary + Submit ─────────────────────── */}
      <section className="rounded-xl border border-star/30 bg-star/5 p-5 max-w-xl mx-auto">
        <div className="space-y-3">
          <span className="text-[11px] text-star uppercase tracking-[0.2em] font-bold block border-b border-star/20 pb-2">
            Swap Summary
          </span>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-dust">Network Mode</span>
              <span className={`font-medium ${form.mode === 'onchain' ? 'text-star' : 'text-chalk'}`}>
                {form.mode === 'offchain' ? 'Gasless (Off-Chain)' : 'On-Chain'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dust">Expiry</span>
              <span className="text-chalk font-medium" suppressHydrationWarning>{formatTimestamp(BigInt(form.deadline))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dust">Protocol Fee</span>
              <span className="text-chalk font-medium">0.15%</span>
            </div>
            {form.matchesVisible && form.hasMatches && (
              <div className="flex justify-between items-center text-sm pt-1 border-t border-star/10">
                <span className="text-dust">Broadcast</span>
                <Switch
                  size="sm"
                  checked={form.broadcastMode}
                  onCheckedChange={form.setBroadcastMode}
                  className="data-[state=checked]:bg-star"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <Web3ActionWrapper message="Connect your wallet to create a swap">
            <Button
              variant="gold"
              size="lg"
              className="w-full h-14 uppercase tracking-[0.2em] text-sm shadow-[0_0_20px_rgba(232,168,37,0.15)] hover:shadow-[0_0_30px_rgba(232,168,37,0.25)] transition-all"
              onClick={form.handleSubmit}
              disabled={form.isPending || form.isCreatingOnChain || form.isChecking}
            >
              {form.isPending || form.isCreatingOnChain ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </div>
              ) : form.isChecking ? 'Checking matches...' : form.submitButtonText}
            </Button>
          </Web3ActionWrapper>
        </div>
      </section>

      {/* ── Match Detection ──────────────────────────────── */}
      {form.matchesVisible && form.hasMatches && !form.broadcastMode && (
        <div className="mt-10">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="w-2 h-2 rounded-full bg-star animate-ping" />
            <span className="text-[10px] font-display tracking-[0.25em] text-star uppercase">
              {form.multiSettleSelection
                ? form.multiSettleSelection.coverage >= 100
                  ? 'Fully Matched'
                  : `${form.multiSettleSelection.coverage}% Matched`
                : 'Match Detected'}
            </span>
          </div>
          <InlineMatchList
            offchainMatches={form.offchainMatches}
            onchainMatches={form.onchainMatches}
            isSwap={true}
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
        availableRoles={SWAP_ROLES}
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
