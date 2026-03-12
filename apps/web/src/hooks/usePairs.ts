'use client'

import { useFetchApi } from './api'
import type { PairAggregate } from '@stela/core'

interface PairsResponse {
  data: PairAggregate[]
}

export type { PairAggregate }

export function usePairs() {
  const { data: raw, isLoading, error, refetch } = useFetchApi<PairsResponse>(
    '/api/pairs',
    undefined,
    15_000,
  )

  return {
    data: raw?.data ?? [],
    isLoading,
    error,
    refetch,
  }
}
