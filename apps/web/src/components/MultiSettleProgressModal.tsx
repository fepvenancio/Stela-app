'use client'

import { useMemo } from 'react'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import type { MultiSettleState } from '@/hooks/useMultiSettle'
import type { StepState, StepStatus } from '@/hooks/useTransactionProgress'

interface MultiSettleProgressModalProps {
  open: boolean
  state: MultiSettleState
  onClose: () => void
}

function buildSteps(state: MultiSettleState): StepState[] {
  const { phase, offchainTotal, onchainTotal, totalOrders, error } = state

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
      errorMessage: status === 'error' ? error ?? undefined : undefined,
    }
  })
}

export function MultiSettleProgressModal({ open, state, onClose }: MultiSettleProgressModalProps) {
  const steps = useMemo(() => buildSteps(state), [state])

  const title = useMemo(() => ({
    processing: `Settling ${state.totalOrders} Orders`,
    complete: 'Settlement Complete',
    failed: 'Settlement Failed',
  }), [state.totalOrders])

  return (
    <TransactionProgressModal
      open={open}
      steps={steps}
      txHash={state.txHash}
      onClose={onClose}
      title={title}
    />
  )
}
