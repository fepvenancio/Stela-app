'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { PairAggregate } from '@stela/core'

interface PairsResponse {
  data: PairAggregate[]
}

export type { PairAggregate }

export function usePairs() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pairs.all,
    queryFn: async () => {
      const res = await fetch('/api/pairs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: PairsResponse = await res.json()
      return json.data
    },
    refetchInterval: 15_000,
  })

  return {
    data: data ?? [],
    isLoading,
    error,
    refetch,
  }
}
