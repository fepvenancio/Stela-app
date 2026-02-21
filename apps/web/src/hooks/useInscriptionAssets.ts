'use client'

import { useState, useEffect } from 'react'
import type { AssetRow } from './useInscriptions'

export function useInscriptionAssets(inscriptionId: string) {
  const [data, setData] = useState<AssetRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/inscriptions/${inscriptionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ assets?: AssetRow[] }>
      })
      .then((json) => {
        setData(Array.isArray(json.assets) ? json.assets : [])
      })
      .catch(() => {
        setData([])
      })
      .finally(() => setIsLoading(false))
  }, [inscriptionId])

  return { data, isLoading }
}
