'use client'

import { useCallback, useMemo, useState } from 'react'

export type StepStatus = 'idle' | 'active' | 'success' | 'error'

export interface StepDefinition {
  label: string
  description?: string
}

export interface StepState extends StepDefinition {
  status: StepStatus
  errorMessage?: string
}

export interface TransactionProgress {
  open: boolean
  steps: StepState[]
  txHash: string | null
  start: () => void
  advance: () => void
  fail: (message: string) => void
  setTxHash: (hash: string) => void
  close: () => void
}

export function useTransactionProgress(definitions: StepDefinition[]): TransactionProgress {
  const [open, setOpen] = useState(false)
  const [stepStatuses, setStepStatuses] = useState<{ status: StepStatus; errorMessage?: string }[]>(
    () => definitions.map(() => ({ status: 'idle' as StepStatus }))
  )
  const [txHash, setTxHashState] = useState<string | null>(null)

  const steps = useMemo<StepState[]>(
    () => definitions.map((def, i) => ({ ...def, ...stepStatuses[i] })),
    [definitions, stepStatuses],
  )

  const start = useCallback(() => {
    setStepStatuses(definitions.map((_, i) => ({ status: i === 0 ? 'active' : 'idle' })))
    setTxHashState(null)
    setOpen(true)
  }, [definitions])

  const advance = useCallback(() => {
    setStepStatuses((prev) => {
      const next = [...prev]
      const activeIdx = next.findIndex((s) => s.status === 'active')
      if (activeIdx >= 0) {
        next[activeIdx] = { status: 'success' }
        if (activeIdx + 1 < next.length) {
          next[activeIdx + 1] = { status: 'active' }
        }
      }
      return next
    })
  }, [])

  const fail = useCallback((message: string) => {
    setStepStatuses((prev) => {
      const next = [...prev]
      const activeIdx = next.findIndex((s) => s.status === 'active')
      if (activeIdx >= 0) {
        next[activeIdx] = { status: 'error', errorMessage: message }
      }
      return next
    })
  }, [])

  const setTxHash = useCallback((hash: string) => {
    setTxHashState(hash)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, steps, txHash, start, advance, fail, setTxHash, close }
}
