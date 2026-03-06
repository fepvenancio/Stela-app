'use client'

import { Circle, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { VOYAGER_TX_URL } from '@/lib/config'
import type { MultiSettleState } from '@/hooks/useMultiSettle'

interface MultiSettleProgressModalProps {
  open: boolean
  state: MultiSettleState
  onClose: () => void
}

type StepStatus = 'idle' | 'active' | 'success' | 'error'

interface Step {
  label: string
  description?: string
  status: StepStatus
  errorMessage?: string
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'idle':
      return <Circle className="w-5 h-5 text-edge" />
    case 'active':
      return <Loader2 className="w-5 h-5 text-star animate-spin" />
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-aurora" />
    case 'error':
      return <XCircle className="w-5 h-5 text-nova" />
  }
}

function buildSteps(state: MultiSettleState): Step[] {
  const { phase, signingIndex, offchainTotal, onchainTotal, totalOrders, error } = state

  const signingLabel = offchainTotal > 0
    ? `Sign batch offer (${offchainTotal} orders)`
    : 'No off-chain signatures needed'
  const signingDesc = onchainTotal > 0 && offchainTotal > 0
    ? `${onchainTotal} on-chain (no sig) + ${offchainTotal} off-chain (1 batch sig)`
    : offchainTotal > 0
      ? 'One signature covers all off-chain orders'
      : `${onchainTotal} on-chain orders — no signatures required`

  const phases: { key: string; label: string; description: string }[] = [
    { key: 'validating', label: 'Validating orders', description: 'Checking nonces and balances' },
    { key: 'signing', label: signingLabel, description: signingDesc },
    { key: 'executing', label: `Settling ${totalOrders} orders on-chain`, description: 'Confirm the multicall transaction' },
    { key: 'confirming', label: 'Confirming', description: 'Waiting for block confirmation' },
    { key: 'recording', label: 'Recording', description: 'Saving settlement details' },
  ]

  const phaseOrder = ['validating', 'signing', 'executing', 'confirming', 'recording', 'done']
  const currentIdx = phaseOrder.indexOf(phase === 'error' ? 'done' : phase)

  return phases.map((p, i) => {
    const pIdx = phaseOrder.indexOf(p.key)
    let status: StepStatus = 'idle'

    if (phase === 'error') {
      // Find the step that was active when error occurred
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
      errorMessage: status === 'error' ? error ?? undefined : undefined,
    }
  })
}

export function MultiSettleProgressModal({ open, state, onClose }: MultiSettleProgressModalProps) {
  const steps = buildSteps(state)
  const isComplete = state.phase === 'done'
  const hasError = state.phase === 'error'
  const canClose = isComplete || hasError

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && canClose) onClose() }}>
      <DialogContent className="bg-void border-edge/50 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
            {isComplete ? 'Settlement Complete' : hasError ? 'Settlement Failed' : `Settling ${state.totalOrders} Orders`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                step.status === 'active' ? 'bg-star/5 border border-star/10' :
                step.status === 'error' ? 'bg-nova/5 border border-nova/10' :
                step.status === 'success' ? 'opacity-60' : 'opacity-40'
              } ${step.status !== 'active' && step.status !== 'error' ? 'border border-transparent' : ''}`}
            >
              <div className="mt-0.5 shrink-0">
                <StepIcon status={step.status} />
              </div>
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-display block ${
                  step.status === 'active' ? 'text-star' :
                  step.status === 'error' ? 'text-nova' :
                  step.status === 'success' ? 'text-chalk' : 'text-dust'
                }`}>
                  {step.label}
                </span>
                {step.description && step.status !== 'error' && (
                  <span className="text-[10px] text-dust block mt-0.5">{step.description}</span>
                )}
                {step.status === 'error' && step.errorMessage && (
                  <span className="text-[10px] text-nova/80 block mt-0.5 break-words">{step.errorMessage}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {state.txHash && (
          <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
            <div className="min-w-0">
              <span className="text-[10px] text-dust uppercase tracking-widest block">Transaction</span>
              <span className="text-xs text-chalk font-mono truncate block">{state.txHash.slice(0, 20)}...</span>
            </div>
            <a
              href={`${VOYAGER_TX_URL}/${state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-star hover:text-star-bright transition-colors shrink-0 ml-2"
            >
              Voyager <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <DialogFooter>
          <Button
            variant={isComplete ? 'gold' : 'ghost'}
            onClick={onClose}
            disabled={!canClose}
            className={isComplete ? 'w-full' : 'text-ash hover:text-chalk'}
          >
            {isComplete ? 'Done' : hasError ? 'Close' : 'Processing...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
