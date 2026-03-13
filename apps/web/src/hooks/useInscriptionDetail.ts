'use client'

import { useMemo } from 'react'
import { useFetchApi } from './api'
import type { InscriptionDetailResponse, AssetRow, ApiDetailResponse } from '@/types/api'

export interface InscriptionDetail {
  id: string
  creator: string
  borrower: string | null
  lender: string | null
  status: string
  issued_debt_percentage: string
  multi_lender: boolean
  duration: string
  deadline: string
  signed_at: string | null
  auction_started: number
  auction_start_time: string
  assets: AssetRow[]
}

/**
 * Fetch a single inscription with all its data from the API (D1).
 * Unlike useInscription (contract read), this returns the indexed data
 * which is always up-to-date after sync.
 */
export function useInscriptionDetail(inscriptionId: string) {
  const url = useMemo(() => inscriptionId ? `/api/inscriptions/${inscriptionId}` : null, [inscriptionId])
  const { data: raw, isLoading, error, refetch } = useFetchApi<ApiDetailResponse<InscriptionDetailResponse>>(url)

  const detail: InscriptionDetail | undefined = useMemo(() => {
    const d = raw?.data
    if (!d) return undefined
    return {
      id: d.id,
      creator: d.creator,
      borrower: d.borrower,
      lender: d.lender,
      status: d.status,
      issued_debt_percentage: d.issued_debt_percentage,
      multi_lender: d.multi_lender,
      duration: d.duration,
      deadline: d.deadline,
      signed_at: d.signed_at,
      auction_started: d.auction_started,
      auction_start_time: d.auction_start_time,
      assets: d.assets ?? [],
    }
  }, [raw])

  const assets = detail?.assets ?? []

  return { data: detail, assets, isLoading, error, refetch }
}
