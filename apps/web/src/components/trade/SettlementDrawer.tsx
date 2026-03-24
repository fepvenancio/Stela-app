'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Clock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstantSettle } from '@/hooks/useInstantSettle'
import { useMultiSettle } from '@/hooks/useMultiSettle'
import { useFeePreview } from '@/hooks/useFeePreview'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { formatDuration } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { VOYAGER_TX_URL } from '@/lib/config'
import { cn } from '@/lib/utils'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { SelectedOrder } from '@/lib/multi-match'
import type { StepStatus } from '@/hooks/useTransactionProgress'

/* ── Public types ──────────────────────────────────────────────────────────── */

/**
 * Pre-formatted display data for the order summary section.
 * The parent component (Best Trades panel) computes these from the order data
 * since it already has the token registry context.
 */
export interface SettlementSummary {
  /** Formatted amount the lender provides, e.g. "1,000 USDC" */
  costLabel: string
  /** Formatted interest/yield the lender receives, e.g. "+50 USDC" */
  interestLabel?: string
  /** APR or rate string, e.g. "5.2% APR" */
  apr?: string
}

export type SettlementDrawerProps = {
  open: boolean
  onClose: () => void
  /** Used to calculate the correct fee preview (default: 'lending') */
  feeType?: 'lending' | 'swap'
  /** Pre-formatted summary data from the parent (Best Trades panel) */
  summary?: SettlementSummary
} & (
  | { mode: 'single'; order: MatchedOrder }
  | { mode: 'batch'; orders: SelectedOrder[] }
)

/* ── Progress step icon ────────────────────────────────────────────────────── */

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'idle':
      return <Circle className="w-4 h-4 text-edge shrink-0" />
    case 'active':
      return <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  }
}

/* ── Step definitions for single-fill flow ─────────────────────────────────── */
// These match the four progress.advance() calls in useInstantSettle:
//   1. after signing the lend offer
//   2. after submitting the multicall tx
//   3. after tx confirmation
//   4. after recording the offer in the backend

const SINGLE_STEPS = [
  { label: 'Sign offer', description: 'Sign the lend offer typed data in your wallet' },
  { label: 'Submit transaction', description: 'Approve tokens + settle in one multicall' },
  { label: 'Confirming on-chain', description: 'Waiting for block inclusion' },
  { label: 'Recording settlement', description: 'Updating backend with offer details' },
]

/* ── Summary row ───────────────────────────────────────────────────────────── */

function SummaryRow({
  label,
  value,
  valueClassName,
  icon: Icon,
}: {
  label: string
  value: string
  valueClassName?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-widest">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      <span className={cn('text-sm font-mono', valueClassName ?? 'text-white')}>
        {value}
      </span>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────────────────── */

export function SettlementDrawer(props: SettlementDrawerProps) {
  const { open, onClose, feeType = 'lending', summary } = props

  /* ── Hooks (all unconditional per React rules) ─────────────────────────── */

  const fees = useFeePreview(feeType)
  const { settle } = useInstantSettle()
  const { settleMultiple, state: multiState, reset: resetMulti } = useMultiSettle()
  const progress = useTransactionProgress(SINGLE_STEPS)

  // Destructure stable references so useCallback deps are minimal
  const { open: progressOpen, steps: progressSteps, txHash: progressTxHash } = progress
  const closeProgress = progress.close
  const resetProgress = progress.close // close() resets state + sets open=false

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Derived: mode ─────────────────────────────────────────────────────── */

  const isBatch = props.mode === 'batch'
  const orderCount = isBatch ? props.orders.length : 1

  /* ── Derived: progress state ───────────────────────────────────────────── */

  // Whether settlement is actively running (block closing)
  const isActive = isBatch
    ? !['idle', 'done', 'error'].includes(multiState.phase)
    : progressOpen && progressSteps.some((s) => s.status === 'active')

  // Whether settlement finished successfully
  const isDone = isBatch
    ? multiState.phase === 'done'
    : progressOpen && progressSteps.length > 0 && progressSteps.every((s) => s.status === 'success')

  // Whether settlement ended with an error
  const hasError = isBatch
    ? multiState.phase === 'error'
    : progressOpen && progressSteps.some((s) => s.status === 'error')

  // Whether the progress panel should be visible
  const showProgress = isBatch ? multiState.phase !== 'idle' : progressOpen

  // Transaction hash from whichever hook is active
  const txHash = isBatch ? multiState.txHash : progressTxHash

  /* ── Derived: summary display ──────────────────────────────────────────── */

  const counterpartyLabel = useMemo(() => {
    if (props.mode === 'single') {
      return formatAddress(props.order.borrower)
    }
    return `${orderCount} order${orderCount !== 1 ? 's' : ''}`
  }, [props, orderCount])

  const durationLabel = useMemo((): string | null => {
    if (props.mode !== 'single') return null
    const raw = props.order.order_data.duration
    if (raw == null) return null
    try {
      return formatDuration(BigInt(String(raw)))
    } catch {
      return String(raw)
    }
  }, [props])

  const deadlineLabel = useMemo((): string | null => {
    if (props.mode !== 'single') return null
    const dl = props.order.deadline
    if (!dl) return null
    return new Date(dl * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [props])

  /* ── Batch progress steps ──────────────────────────────────────────────── */

  const batchSteps = useMemo(() => {
    if (!isBatch) return []
    const { phase, offchainTotal, onchainTotal, totalOrders, error } = multiState

    const signingLabel =
      offchainTotal > 0
        ? `Sign batch offer (${offchainTotal} off-chain)`
        : 'No off-chain signatures needed'

    const phases = [
      { key: 'validating', label: 'Validating orders', description: 'Checking nonces and balances' },
      { key: 'signing', label: signingLabel, description: 'One signature covers all off-chain orders' },
      {
        key: 'executing',
        label: `Settling ${totalOrders} order${totalOrders !== 1 ? 's' : ''} on-chain`,
        description: `${onchainTotal} on-chain + ${offchainTotal} off-chain in one multicall`,
      },
      { key: 'confirming', label: 'Confirming', description: 'Waiting for block inclusion' },
      { key: 'recording', label: 'Recording', description: 'Saving settlement details' },
    ]

    const phaseOrder = ['validating', 'signing', 'executing', 'confirming', 'recording', 'done']
    const currentIdx = phaseOrder.indexOf(phase === 'error' ? 'done' : phase)

    return phases.map((p) => {
      const pIdx = phaseOrder.indexOf(p.key)
      let status: StepStatus = 'idle'

      if (phase === 'error') {
        if (pIdx < currentIdx) status = 'success'
        else if (pIdx === currentIdx) status = 'error'
      } else if (phase === 'done') {
        status = 'success'
      } else if (pIdx < currentIdx) {
        status = 'success'
      } else if (pIdx === currentIdx) {
        status = 'active'
      }

      return {
        label: p.label,
        description: p.description,
        status,
        errorMessage: status === 'error' ? (error ?? undefined) : undefined,
      }
    })
  }, [isBatch, multiState])

  const activeSteps = isBatch ? batchSteps : progressSteps

  /* ── Auto-close on success ─────────────────────────────────────────────── */

  useEffect(() => {
    if (isDone) {
      autoCloseRef.current = setTimeout(() => {
        handleClose()
      }, 2000)
    }
    return () => {
      if (autoCloseRef.current !== null) {
        clearTimeout(autoCloseRef.current)
        autoCloseRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone])

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  const handleClose = useCallback(() => {
    if (isActive) return
    if (autoCloseRef.current !== null) {
      clearTimeout(autoCloseRef.current)
      autoCloseRef.current = null
    }
    closeProgress()
    resetMulti()
    onClose()
  }, [isActive, closeProgress, resetMulti, onClose])

  const handleReset = useCallback(() => {
    // Reset progress so user can try again without closing the drawer
    resetProgress()
    resetMulti()
  }, [resetProgress, resetMulti])

  const handleConfirm = useCallback(async () => {
    try {
      if (props.mode === 'single') {
        await settle(props.order, progress)
      } else {
        await settleMultiple(props.orders)
      }
    } catch {
      // Errors are handled inside settle/settleMultiple (toast + progress.fail)
    }
  }, [props, settle, settleMultiple, progress])

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isActive) handleClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-[#050505]/70 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-300',
          )}
        />

        {/* Drawer panel — bottom sheet on mobile, side panel on desktop */}
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => { if (isActive) e.preventDefault() }}
          onInteractOutside={(e) => { if (isActive) e.preventDefault() }}
          className={cn(
            // Base
            'fixed z-50 flex flex-col bg-[#050505] outline-none focus:outline-none',
            // Border
            'border-border/50',
            // Mobile: bottom sheet (full width, slide up from bottom)
            'inset-x-0 bottom-0 max-h-[90dvh]',
            'rounded-t-2xl border-t border-l border-r',
            // Desktop: right side panel (full height)
            'lg:inset-x-auto lg:inset-y-0 lg:right-0',
            'lg:w-[420px] lg:max-h-none',
            'lg:rounded-l-2xl lg:rounded-r-none lg:rounded-t-none',
            'lg:border-l lg:border-t-0 lg:border-r-0 lg:border-b-0',
            // Entrance animation
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            // Mobile: slide from bottom
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            // Desktop: slide from right (overrides mobile direction)
            'lg:data-[state=closed]:slide-out-to-right lg:data-[state=open]:slide-in-from-right',
            'lg:data-[state=closed]:slide-out-to-bottom-0 lg:data-[state=open]:slide-in-from-bottom-0',
            'duration-300',
          )}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <DialogPrimitive.Title className="font-bold text-sm tracking-widest text-accent uppercase">
              {isDone
                ? 'Settlement Complete'
                : hasError
                  ? 'Settlement Failed'
                  : isBatch
                    ? `Confirm ${orderCount} Fill${orderCount !== 1 ? 's' : ''}`
                    : 'Confirm Fill'}
            </DialogPrimitive.Title>

            <button
              type="button"
              onClick={handleClose}
              disabled={isActive}
              aria-label="Close settlement drawer"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full',
                'text-gray-400 hover:text-white hover:bg-surface/30 transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3 min-h-0">

            {/* Order summary card */}
            <div className="rounded-xl border border-border/30 bg-surface/10 divide-y divide-edge/20">
              <SummaryRow
                label={isBatch ? 'Orders' : 'Counterparty'}
                value={counterpartyLabel}
                icon={User}
              />

              {durationLabel && (
                <SummaryRow label="Duration" value={durationLabel} icon={Clock} />
              )}

              {summary?.costLabel && (
                <SummaryRow label="Your cost" value={summary.costLabel} />
              )}

              {summary?.interestLabel && (
                <SummaryRow
                  label="You receive"
                  value={summary.interestLabel}
                  valueClassName="text-green-500 font-mono"
                />
              )}

              {summary?.apr && (
                <SummaryRow
                  label="APR"
                  value={summary.apr}
                  valueClassName="text-accent font-mono"
                />
              )}

              {deadlineLabel && (
                <SummaryRow
                  label="Expires"
                  value={deadlineLabel}
                  valueClassName="text-gray-400 font-mono"
                />
              )}
            </div>

            {/* Fee breakdown card */}
            <div className="rounded-xl border border-border/30 bg-surface/10 divide-y divide-edge/20">
              <div className="px-4 py-2.5">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Protocol fees</span>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-400">Relayer</span>
                <span className="text-xs text-white">{fees.relayerBps / 100}%</span>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-400">Treasury</span>
                <div className="flex items-center gap-2">
                  {fees.discountPercent > 0 && (
                    <span className="text-[10px] text-gray-400 line-through">
                      {fees.treasuryBps / 100}%
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      fees.discountPercent > 0 ? 'text-green-500' : 'text-white',
                    )}
                  >
                    {fees.effectiveTreasuryBps / 100}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-400 font-medium">Total</span>
                <div className="flex items-center gap-2">
                  {fees.savingsBps > 0 && (
                    <span className="text-[10px] text-green-500">
                      -{fees.savingsBps / 100}%
                    </span>
                  )}
                  <span className="text-xs text-white font-medium">
                    {fees.effectiveTotalBps / 100}%
                  </span>
                </div>
              </div>

              {fees.discountPercent > 0 && (
                <div className="px-4 py-2">
                  <span className="text-[10px] text-green-500">
                    {fees.discountPercent}% Genesis NFT discount
                    {fees.volumeTier > 0 ? ` (volume tier ${fees.volumeTier})` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Inline progress steps — visible after Confirm is clicked */}
            {showProgress && (
              <div className="space-y-1">
                {activeSteps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl transition-colors border',
                      step.status === 'active'
                        ? 'bg-accent/5 border-accent/10'
                        : step.status === 'error'
                          ? 'bg-red-500/5 border-red-500/10'
                          : step.status === 'success'
                            ? 'opacity-60 border-transparent'
                            : 'opacity-40 border-transparent',
                    )}
                  >
                    <div className="mt-0.5">
                      <StepIcon status={step.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-sm font-bold block',
                          step.status === 'active'
                            ? 'text-accent'
                            : step.status === 'error'
                              ? 'text-red-500'
                              : step.status === 'success'
                                ? 'text-white'
                                : 'text-gray-400',
                        )}
                      >
                        {step.label}
                      </span>

                      {step.description && step.status !== 'error' && (
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {step.description}
                        </span>
                      )}

                      {step.status === 'error' && step.errorMessage && (
                        <span className="text-[10px] text-red-500/80 block mt-0.5 break-words">
                          {step.errorMessage}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Transaction hash link */}
                {txHash && (
                  <div className="flex items-center justify-between p-3 bg-surface/20 border border-border/20 rounded-xl mt-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Transaction
                      </span>
                      <span className="text-xs text-white font-mono truncate block">
                        {txHash.slice(0, 20)}…
                      </span>
                    </div>
                    <a
                      href={`${VOYAGER_TX_URL}/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors shrink-0 ml-2"
                    >
                      Voyager <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer (CTA) ────────────────────────────────────────────── */}
          <div className="px-5 pb-6 pt-3 shrink-0 border-t border-border/20">

            {/* Pre-confirm: primary CTA */}
            {!showProgress && (
              <Button
                variant="default"
                size="xl"
                className="w-full"
                onClick={handleConfirm}
                disabled={isActive}
              >
                {isBatch ? `Fill ${orderCount} Order${orderCount !== 1 ? 's' : ''}` : 'Fill Order'}
              </Button>
            )}

            {/* In-progress: spinner indicator */}
            {showProgress && !isDone && !hasError && (
              <div className="flex items-center justify-center gap-2 h-11 text-gray-400">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span className="text-sm">Processing…</span>
              </div>
            )}

            {/* Success: done button (auto-closes after 2s) */}
            {showProgress && isDone && (
              <Button
                variant="accent"
                size="xl"
                className="w-full"
                onClick={handleClose}
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
              </Button>
            )}

            {/* Error: try-again + close */}
            {showProgress && hasError && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="xl"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  size="xl"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
