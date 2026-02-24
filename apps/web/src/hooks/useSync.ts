'use client'

import { useState, useCallback } from 'react'

export interface SyncAssets {
  debt: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
  interest: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
  collateral: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
}

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false)

  const sync = useCallback(async (txHash: string, assets?: SyncAssets) => {
    setIsSyncing(true)
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: txHash, assets }),
      })
      window.dispatchEvent(new Event('stela:sync'))
    } finally {
      setIsSyncing(false)
    }
  }, [])

  return { sync, isSyncing }
}
