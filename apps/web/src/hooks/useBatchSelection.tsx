'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AssetRow } from '@/types/api'

export interface SelectedInscription {
  id: string
  assets: AssetRow[]
  multiLender: boolean
}

interface BatchSelectionContextValue {
  selectionMode: boolean
  setSelectionMode: (v: boolean) => void
  selected: Map<string, SelectedInscription>
  toggle: (item: SelectedInscription) => void
  isSelected: (id: string) => boolean
  clearAll: () => void
  count: number
}

const BatchSelectionContext = createContext<BatchSelectionContextValue | null>(null)

const MAX_SELECTIONS = 10

export function BatchSelectionProvider({ children }: { children: ReactNode }) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Map<string, SelectedInscription>>(new Map())

  const toggle = useCallback((item: SelectedInscription) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        if (next.size >= MAX_SELECTIONS) return prev
        next.set(item.id, item)
      }
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const clearAll = useCallback(() => {
    setSelected(new Map())
  }, [])

  const handleSetSelectionMode = useCallback((v: boolean) => {
    setSelectionMode(v)
    if (!v) setSelected(new Map())
  }, [])

  const count = selected.size

  const value = useMemo(
    () => ({ selectionMode, setSelectionMode: handleSetSelectionMode, selected, toggle, isSelected, clearAll, count }),
    [selectionMode, handleSetSelectionMode, selected, toggle, isSelected, clearAll, count],
  )

  return <BatchSelectionContext.Provider value={value}>{children}</BatchSelectionContext.Provider>
}

export function useBatchSelection() {
  const ctx = useContext(BatchSelectionContext)
  if (!ctx) {
    throw new Error('useBatchSelection must be used within BatchSelectionProvider')
  }
  return ctx
}
