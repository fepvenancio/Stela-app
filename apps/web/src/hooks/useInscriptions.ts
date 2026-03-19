'use client'

import { useQuery, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'
import type { InscriptionRow, InscriptionListParams, ApiListResponse } from '@/types/api'

export type { InscriptionRow }
export type { AssetRow } from '@/types/api'

/**
 * useInscriptions - fetches indexed inscriptions with polling via TanStack Query.
 */
export function useInscriptions(params?: InscriptionListParams) {
  const filters = {
    status: params?.status || undefined,
    address: params?.address,
    page: params?.page,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inscriptions.list(filters),
    queryFn: async () => {
      const url = buildApiUrl('/api/inscriptions', {
        status: filters.status,
        address: filters.address,
        page: filters.page,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ApiListResponse<InscriptionRow> = await res.json()
      return json.data
    },
    refetchInterval: 15_000,
  })

  return { data: data ?? [], isLoading, error, refetch }
}

/** Push an optimistic inscription into the TanStack Query cache */
export function addOptimisticInscription(queryClient: QueryClient, inscription: InscriptionRow) {
  queryClient.setQueryData(
    queryKeys.inscriptions.list({ status: undefined, address: undefined, page: undefined }),
    (old: InscriptionRow[] | undefined) => [inscription, ...(old ?? [])],
  )
}
