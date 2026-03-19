'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'
import type { InscriptionRow } from '@/types/api'
import type { OrderRow } from './useOrders'

interface PairListingsResponse {
  data: {
    debt_token: string
    collateral_token: string
    inscriptions: InscriptionRow[]
    orders: OrderRow[]
  }
  meta?: {
    page: number
    limit: number
    inscriptions_total?: number
    orders_total?: number
  }
}

const PAIR_LIMIT = 50

export function usePairListings(debtToken: string, collateralToken: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pairs.listings(debtToken, collateralToken),
    queryFn: async () => {
      const url = buildApiUrl(`/api/pairs/${debtToken}-${collateralToken}`, {
        limit: PAIR_LIMIT,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as PairListingsResponse
    },
    enabled: Boolean(debtToken && collateralToken),
    refetchInterval: 15_000,
  })

  const inscriptions = data?.data?.inscriptions ?? []
  const orders = data?.data?.orders ?? []
  const total = (data?.meta?.inscriptions_total ?? inscriptions.length) +
    (data?.meta?.orders_total ?? orders.length)
  const loaded = inscriptions.length + orders.length

  return {
    inscriptions,
    orders,
    isLoading,
    isLoadingMore: false,
    error,
    refetch,
    hasMore: false,
    total,
    loaded,
    loadMore: () => {},
  }
}
