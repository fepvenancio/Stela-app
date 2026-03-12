'use client'

import { useMemo } from 'react'
import { useFetchApi } from './api'
import type { InscriptionRow } from '@/types/api'
import type { OrderRow } from './useOrders'

interface PairListingsResponse {
  data: {
    debt_token: string
    collateral_token: string
    inscriptions: InscriptionRow[]
    orders: OrderRow[]
  }
}

export function usePairListings(debtToken: string, collateralToken: string) {
  const url = useMemo(
    () =>
      debtToken && collateralToken
        ? `/api/pairs/${debtToken}-${collateralToken}`
        : null,
    [debtToken, collateralToken],
  )

  const { data: raw, isLoading, error, refetch } = useFetchApi<PairListingsResponse>(
    url,
    undefined,
    15_000,
  )

  return {
    inscriptions: raw?.data?.inscriptions ?? [],
    orders: raw?.data?.orders ?? [],
    isLoading,
    error,
    refetch,
  }
}
