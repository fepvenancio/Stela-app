'use client'

import { useMemo } from 'react'
import { useFetchApi, buildApiUrl } from './api'
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
  const url = useMemo(() => {
    if (!debtToken || !collateralToken) return null
    return buildApiUrl(`/api/orderbook/${debtToken}_${collateralToken}`, {
      duration: options?.duration && options.duration !== 'all' ? options.duration : undefined,
    })
  }, [debtToken, collateralToken, options?.duration])

  const interval = options?.refreshInterval ?? 30_000

  const { data, isLoading, error, refetch } = useFetchApi<OrderBookResponse>(url, undefined, interval)

  return { data: data ?? null, isLoading, error: error?.message ?? null, refetch }
}
