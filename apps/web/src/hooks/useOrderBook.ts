'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'
import type { OrderBookResponse, DurationFilter } from '@/types/orderbook'

interface UseOrderBookOptions {
  /** Filter by duration bucket. Defaults to 'all'. */
  duration?: DurationFilter
  /** Polling interval in ms. Defaults to 30_000 (30s). */
  refreshInterval?: number
}

export function useOrderBook(
  debtToken: string,
  collateralToken: string,
  options?: UseOrderBookOptions,
) {
  const durationParam = options?.duration && options.duration !== 'all' ? options.duration : undefined

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.book(debtToken, collateralToken, durationParam),
    queryFn: async () => {
      const url = buildApiUrl(`/api/orderbook/${debtToken}_${collateralToken}`, {
        duration: durationParam,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<OrderBookResponse>
    },
    enabled: Boolean(debtToken && collateralToken),
    refetchInterval: options?.refreshInterval ?? 30_000,
  })

  return { data: data ?? null, isLoading, error: error?.message ?? null, refetch }
}
