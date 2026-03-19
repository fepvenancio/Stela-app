'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { AssetRow, InscriptionDetailResponse, ApiDetailResponse } from '@/types/api'

export function useInscriptionAssets(inscriptionId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inscriptions.detail(inscriptionId),
    queryFn: async () => {
      const res = await fetch(`/api/inscriptions/${inscriptionId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<ApiDetailResponse<InscriptionDetailResponse>>
    },
    enabled: Boolean(inscriptionId),
    select: (data) => data?.data?.assets ?? [],
  })

  return { data: data ?? [], isLoading, error, refetch }
}
