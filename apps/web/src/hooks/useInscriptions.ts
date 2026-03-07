'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useFetchApi, buildApiUrl } from './api'
import type { InscriptionRow, InscriptionListParams, ApiListResponse } from '@/types/api'

export type { InscriptionRow }
export type { AssetRow } from '@/types/api'

/**
 * useInscriptions - fetches indexed inscriptions with polling and sync support.
 * Also supports local optimistic updates for newly created inscriptions.
 */
export function useInscriptions(params?: InscriptionListParams) {
  const url = useMemo(
    () =>
      buildApiUrl('/api/inscriptions', {
        status: params?.status || undefined,
        address: params?.address,
        page: params?.page,
      }),
    [params?.status, params?.address, params?.page],
  )

  const { data: raw, isLoading, error, refetch } = useFetchApi<ApiListResponse<InscriptionRow>>(url, undefined, 15_000)
  
  // Local state for pending (optimistic) inscriptions
  const [optimisticInscriptions, setOptimisticInscriptions] = useState<InscriptionRow[]>([])

  // Listen for optimistic creation events
  useEffect(() => {
    const handleOptimistic = (e: any) => {
      const newInscription = e.detail as InscriptionRow
      setOptimisticInscriptions(prev => [newInscription, ...prev])
    }
    window.addEventListener('stela:optimistic-create', handleOptimistic)
    return () => window.removeEventListener('stela:optimistic-create', handleOptimistic)
  }, [])

  // Clear optimistic inscriptions when they appear in the indexed data
  useEffect(() => {
    if (raw?.data && optimisticInscriptions.length > 0) {
      const indexedIds = new Set(raw.data.map(i => i.id))
      setOptimisticInscriptions(prev => prev.filter(i => !indexedIds.has(i.id)))
    }
  }, [raw?.data, optimisticInscriptions.length])

  const data = useMemo(() => {
    const indexed = raw?.data ?? []
    // Filter out duplicates if any (should be handled by the clear logic above but safe-guarded here)
    const indexedIds = new Set(indexed.map(i => i.id))
    const filteredOptimistic = optimisticInscriptions.filter(i => !indexedIds.has(i.id))
    
    // Sort combined data: pending first, then by creation date
    return [...filteredOptimistic, ...indexed]
  }, [raw?.data, optimisticInscriptions])

  return { data, isLoading, error, refetch }
}

/** Utility to push an optimistic inscription into the UI */
export function addOptimisticInscription(inscription: InscriptionRow) {
  window.dispatchEvent(new CustomEvent('stela:optimistic-create', { detail: inscription }))
}
