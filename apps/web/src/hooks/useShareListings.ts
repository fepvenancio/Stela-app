'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'

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
  const filterParams: Record<string, string | undefined> = {
    inscription_id: params?.inscription_id,
    seller: params?.seller,
    status: params?.status ?? 'active',
    page: params?.page?.toString(),
    limit: params?.limit?.toString(),
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.shares.listings(filterParams),
    queryFn: async () => {
      const url = buildApiUrl('/api/share-listings', {
        inscription_id: params?.inscription_id,
        seller: params?.seller,
        status: params?.status ?? 'active',
        page: params?.page,
        limit: params?.limit,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ data: ShareListing[] }>
    },
    refetchInterval: 30_000,
  })

  return { data, isLoading, error, refetch }
}

/** Fetch a single share listing by ID */
export function useShareListing(id: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.shares.detail(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/share-listings/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ data: ShareListing }>
    },
    enabled: Boolean(id),
  })

  return { data, isLoading, error, refetch }
}
