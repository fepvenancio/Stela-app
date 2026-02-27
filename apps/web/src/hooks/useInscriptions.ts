'use client'

import { useMemo } from 'react'
import { useFetchApi, buildApiUrl } from './api'
import type { InscriptionRow, InscriptionListParams, ApiListResponse } from '@/types/api'

export type { InscriptionRow }
export type { AssetRow } from '@/types/api'

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
  const data = raw?.data ?? []

  return { data, isLoading, error, refetch }
}
