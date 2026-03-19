'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'

/** Row shape returned by the /api/orders list endpoint */
export interface OrderRow {
  id: string
  borrower: string
  order_data: string | Record<string, unknown>
  borrower_signature: string
  nonce: string
  deadline: number
  status: string
  created_at: number
}

/** Response shape for GET /api/orders/:id */
export interface OrderDetailResponse extends OrderRow {
  offers: OrderOfferRow[]
}

/** Offer row shape from the order_offers table */
export interface OrderOfferRow {
  id: string
  order_id: string
  lender: string
  bps: number
  lender_signature: string
  nonce: string
  created_at: number
}

interface OrderListParams {
  status?: string
  address?: string
  page?: number
  limit?: number
}

interface ApiOrderListResponse {
  data: OrderRow[]
  meta: { page: number; limit: number; total: number }
}

export function useOrders(params?: OrderListParams) {
  const filters = {
    status: params?.status,
    address: params?.address,
    page: params?.page,
    limit: params?.limit,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async () => {
      const url = buildApiUrl('/api/orders', {
        status: filters.status ?? 'all',
        address: filters.address,
        page: filters.page,
        limit: filters.limit ?? 50,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ApiOrderListResponse = await res.json()
      return json.data
    },
    refetchInterval: 30_000,
  })

  return { data: data ?? [], isLoading, error, refetch }
}

export function useOrder(id: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: { data: OrderDetailResponse } = await res.json()
      return json.data
    },
    enabled: Boolean(id),
    refetchInterval: 5_000,
  })

  return { data, isLoading, error, refetch }
}
