'use client'

import { useMemo } from 'react'
import { useFetchApi } from './api'
import type { AssetRow, InscriptionDetailResponse, ApiDetailResponse } from '@/types/api'

export function useInscriptionAssets(inscriptionId: string) {
  const url = useMemo(() => inscriptionId ? `/api/inscriptions/${inscriptionId}` : null, [inscriptionId])
  const { data: raw, isLoading, error, refetch } = useFetchApi<ApiDetailResponse<InscriptionDetailResponse>>(url)
  const data: AssetRow[] = raw?.data?.assets ?? []

  return { data, isLoading, error, refetch }
}
