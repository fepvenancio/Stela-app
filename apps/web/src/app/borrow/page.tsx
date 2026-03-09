'use client'

import { useState } from 'react'
import { useOrderForm, ROLES } from '@/hooks/useOrderForm'
import type { AssetRole } from '@/hooks/useOrderForm'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { formatTimestamp } from '@/lib/format'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { InlineMatchList } from '@/components/InlineMatchList'
import { AssetRow } from './components/AssetRow'
import { AddAssetModal } from './components/AddAssetModal'
import { InlineBorrowForm } from './components/InlineBorrowForm'

/* ── Constants ──────────────────────────────────────────── */

const DURATION_PRESETS = [
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '90d', seconds: 7776000 },
  { label: '180d', seconds: 15552000 },
  { label: '1y', seconds: 31536000 },
]

const DEADLINE_PRESETS = [
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '60d', seconds: 5184000 },
  { label: '90d', seconds: 7776000 },
]

const CUSTOM_DURATION_UNITS = [
  { label: 'Days', multiplier: 86400 },
  { label: 'Weeks', multiplier: 604800 },
  { label: 'Months', multiplier: 2592000 },
]

function formatDurationHuman(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  const days = Math.round(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''}`
}

/* ════════════════════════════════════════════════════════════
   BORROW PAGE — Lending only
   ════════════════════════════════════════════════════════════ */

export default function BorrowPage() {
  const form = useOrderForm('lending')
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="animate-fade-up pb-24 relative max-w-3xl mx-auto">

      {/* ── Ambient Background ───────────────────────────── */}
      <div className="hidden sm:fixed sm:block top-1/4 -left-20 w-64 h-64 bg-star/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="hidden sm:fixed sm:block bottom-1/4 -right-20 w-64 h-64 bg-nebula/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* ── Header ────────── */}
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Borrow
        </h1>
        <p className="text-dust max-w-lg mx-auto leading-relaxed mb-6">
          Borrow any ERC20 — stables, vault shares, LP tokens — fully peer-to-peer. Every position becomes a tradeable share on a built-in secondary market.
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

      {/* ── Settings ─────────────────────────────────────── */}
      <div className="mb-8 max-w-xl mx-auto space-y-3">
        {/* Duration */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0">Duration</span>
          {form.useCustomDuration ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                type="number"
                value={form.customDurationValue}
                onChange={(e) => form.setCustomDurationValue(e.target.value)}
                className="w-20 bg-surface/50 border-edge/50 font-mono h-7 text-xs"
                placeholder="Amount"
                min="1"
              />
              {CUSTOM_DURATION_UNITS.map((u) => (
                <button
                  key={u.multiplier}
                  type="button"
                  onClick={() => form.setCustomDurationUnit(u.multiplier)}
                  className={`py-1 px-2.5 rounded-lg text-[10px] border transition-all cursor-pointer font-medium ${
                    form.customDurationUnit === u.multiplier ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk'
                  }`}
                >{u.label}</button>
              ))}
              <span className="text-[10px] text-dust italic">= {formatDurationHuman(Number(form.duration))}</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => form.setDurationPreset(p.seconds.toString())}
                  className={`py-1 px-2.5 rounded-lg text-[10px] border transition-all cursor-pointer font-medium ${
                    form.durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => form.setUseCustomDuration(!form.useCustomDuration)}
            className="text-[10px] text-star hover:text-star-bright transition-colors cursor-pointer font-bold uppercase tracking-wider shrink-0"
          >
            {form.useCustomDuration ? 'Presets' : 'Custom'}
          </button>
        </div>

        {/* Expiry */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0">Expiry</span>
          <div className="flex flex-wrap gap-1.5">
            {DEADLINE_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => form.setDeadlinePreset(p.seconds.toString())}
                className={`py-1 px-2.5 rounded-lg text-[10px] border transition-all cursor-pointer font-medium ${
                  form.deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                }`}
              >{p.label}</button>
            ))}
          </div>
          <span className="text-[10px] text-dust" suppressHydrationWarning>{formatTimestamp(BigInt(form.deadline))}</span>
        </div>

        {/* Mode + Funding */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Mode</span>
            <div className="flex gap-1">
              {(['offchain', 'onchain'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => form.setMode(m)}
                  className={`py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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
          <div className="w-px h-4 bg-edge/30 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Funding</span>
            <div className="flex gap-1">
              {([
                { value: 'single', label: 'Single' },
                { value: 'multi', label: 'Multi' },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => form.setMultiLender(f.value === 'multi')}
                  className={`py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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
        </div>
      </div>

      {/* ── Inline Borrow Form ──────────────────────────── */}
      <div className="mb-4">
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
      </div>

      {/* ── Validation Errors ──────────────────────────────── */}
      {form.showErrors && (!form.hasDebt || !form.hasCollateral) && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-nova/20 bg-nova/5 max-w-xl mx-auto">
          <p className="text-xs text-nova font-medium">
            {!form.hasDebt && '• Add at least one borrow asset. '}
            {!form.hasCollateral && '• Add at least one collateral asset.'}
          </p>
        </div>
      )}

      {/* ── Advanced Options (collapsible) ─────────────────── */}
      <div className="mb-4 max-w-xl mx-auto">
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
          <div className="mt-4 animate-fade-up">
            <section className="rounded-xl border border-edge/30 overflow-clip bg-surface/5">
              <div className="flex items-center justify-between px-4 py-3 border-b border-edge/30 bg-surface/10">
                <span className="text-[11px] text-dust uppercase tracking-widest font-bold">
                  Inscription Assets
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
                  className="w-full min-h-[100px] hover:bg-surface/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-5"
                >
                  <div className="w-9 h-9 rounded-xl bg-surface/30 border border-edge/50 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash"><path d="M8 3v10M3 8h10" /></svg>
                  </div>
                  <p className="text-xs text-dust">Add extra assets for multi-asset orders</p>
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

      {/* ── Submit ────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto flex flex-col items-end gap-3 mb-8">
        <Web3ActionWrapper message="Connect your wallet to create an inscription">
          <Button
            variant="gold"
            size="xl"
            className="px-10 uppercase tracking-[0.2em] text-sm shadow-[0_0_20px_rgba(232,168,37,0.15)] hover:shadow-[0_0_30px_rgba(232,168,37,0.25)] transition-all"
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
        <div className="flex items-center gap-3 text-[11px] text-ash">
          <span className={form.mode === 'offchain' ? 'text-aurora' : 'text-star'}>
            {form.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
          </span>
          <span className="text-edge">·</span>
          <span>0.25% fee</span>
          <span className="text-edge">·</span>
          <span>{formatDurationHuman(Number(form.duration))}</span>
          {form.roiInfo && (
            <>
              <span className="text-edge">·</span>
              <span className="text-aurora font-medium">+{form.roiInfo.yieldPct}%</span>
            </>
          )}
        </div>
      </div>

      {/* ── Match Detection ──────────────────────────────── */}
      {form.matchesVisible && form.hasMatches && !form.broadcastMode && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-star animate-ping" />
              <span className="text-[10px] font-display tracking-[0.25em] text-star uppercase">
                Match Detected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Broadcast</span>
              <Switch
                size="sm"
                checked={form.broadcastMode}
                onCheckedChange={form.setBroadcastMode}
                className="data-[state=checked]:bg-star"
              />
            </div>
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
