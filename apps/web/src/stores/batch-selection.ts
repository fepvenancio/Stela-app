import { create } from 'zustand'
import type { AssetRow } from '@/types/api'

export interface SelectedInscription {
  id: string
  assets: AssetRow[]
  multiLender: boolean
  source: 'onchain' | 'offchain'
  /** Off-chain order data (only set when source='offchain') */
  orderData?: {
    borrower: string
    borrower_signature: string
    nonce: string
    deadline: number | string
    created_at: number | string
    order_data: Record<string, unknown>
  }
}

interface BatchSelectionStore {
  selected: Map<string, SelectedInscription>
  toggle: (item: SelectedInscription) => void
  isSelected: (id: string) => boolean
  clearAll: () => void
  count: number
}

const MAX_SELECTIONS = 10

export const useBatchSelection = create<BatchSelectionStore>((set, get) => ({
  selected: new Map(),
  toggle: (item) =>
    set((state) => {
      const next = new Map(state.selected)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else if (next.size < MAX_SELECTIONS) {
        next.set(item.id, item)
      }
      return { selected: next, count: next.size }
    }),
  isSelected: (id) => get().selected.has(id),
  clearAll: () => set({ selected: new Map(), count: 0 }),
  count: 0,
}))
