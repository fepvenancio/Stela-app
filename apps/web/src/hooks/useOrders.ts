'use client'

import { useMemo } from 'react'
import { useFetchApi, buildApiUrl } from './api'

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
  lender_commitment?: string
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
  const url = useMemo(
    () =>
      buildApiUrl('/api/orders', {
        status: params?.status ?? 'all',
        address: params?.address,
        page: params?.page,
        limit: params?.limit ?? 50,
      }),
    [params?.status, params?.address, params?.page, params?.limit],
  )

  const { data: raw, isLoading, error, refetch } = useFetchApi<ApiOrderListResponse>(url, undefined, 10_000)
  const data = raw?.data ?? []

  return { data, isLoading, error, refetch }
}

export function useOrder(id: string) {
  const url = useMemo(() => (id ? `/api/orders/${id}` : null), [id])
  const { data: raw, isLoading, error, refetch } = useFetchApi<{ data: OrderDetailResponse }>(url, undefined, 5_000)

  return { data: raw?.data, isLoading, error, refetch }
}
