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
import type { StepState } from '@/hooks/useTransactionProgress'

export interface TransactionProgressModalProps {
  open: boolean
  steps: StepState[]
  txHash: string | null
  onClose: () => void
  /** Override the default title (defaults to Processing / Complete / Failed) */
  title?: { processing: string; complete: string; failed: string }
}

function StepIcon({ status }: { status: StepState['status'] }) {
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

export function TransactionProgressModal({ open, steps, txHash, onClose, title }: TransactionProgressModalProps) {
  const isComplete = steps.every((s) => s.status === 'success')
  const hasError = steps.some((s) => s.status === 'error')

  const labels = title ?? {
    processing: 'Processing Transaction',
    complete: 'Transaction Complete',
    failed: 'Transaction Failed',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-void border-edge/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
            {isComplete ? labels.complete : hasError ? labels.failed : labels.processing}
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

        {txHash && (
          <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
            <div className="min-w-0">
              <span className="text-[10px] text-dust uppercase tracking-widest block">Transaction</span>
              <span className="text-xs text-chalk font-mono truncate block">{txHash.slice(0, 20)}...</span>
            </div>
            <a
              href={`${VOYAGER_TX_URL}/${txHash}`}
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
            variant={isComplete ? 'default' : hasError ? 'outline' : 'ghost'}
            size="lg"
            onClick={onClose}
            className="w-full"
          >
            {isComplete ? 'Done' : hasError ? 'Close' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
