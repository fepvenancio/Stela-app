'use client'

import { useState, useCallback } from 'react'

export interface SyncAssets {
  debt: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
  interest: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
  collateral: { asset_address: string; asset_type: string; value: string; token_id?: string }[]
}

const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 2000

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false)

  const sync = useCallback(async (txHash: string, assets?: SyncAssets) => {
    setIsSyncing(true)
    let attempt = 0
    let delay = INITIAL_DELAY_MS

    const trySync = async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: txHash, assets }),
        })
        
        if (res.ok) return true
        if (res.status === 404) return false // pending or not found, should retry
        return true // other errors (400, 422), no point retrying
      } catch {
        return false // network error, maybe retry
      }
    }

    try {
      while (attempt < MAX_RETRIES) {
        const success = await trySync()
        if (success) break
        
        attempt++
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, delay))
          delay *= 1.5 // Exponential backoff
        }
      }
    } finally {
      window.dispatchEvent(new Event('stela:sync'))
      setIsSyncing(false)
    }
  }, [])

  return { sync, isSyncing }
}
