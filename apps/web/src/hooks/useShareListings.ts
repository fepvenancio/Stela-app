'use client'

import { useFetchApi, buildApiUrl } from './api'

interface ShareListing {
  id: string
  inscription_id: string
  seller: string
  shares: string
  payment_token: string
  price: string
  status: string
  deadline: number
  created_at: number
  filled_by: string | null
  filled_at: number | null
  tx_hash: string | null
}

/** Fetch share listings with optional filters */
export function useShareListings(params?: {
  inscription_id?: string
  seller?: string
  status?: string
  page?: number
  limit?: number
}) {
  const url = buildApiUrl('/api/share-listings', {
    inscription_id: params?.inscription_id,
    seller: params?.seller,
    status: params?.status ?? 'active',
    page: params?.page,
    limit: params?.limit,
  })

  return useFetchApi<{ data: ShareListing[] }>(url, undefined, 10_000)
}

/** Fetch a single share listing by ID */
export function useShareListing(id: string | null) {
  return useFetchApi<{ data: ShareListing }>(
    id ? `/api/share-listings/${id}` : null
  )
}
