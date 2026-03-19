'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
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
  const [inscriptions, setInscriptions] = useState<InscriptionRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [inscriptionsTotal, setInscriptionsTotal] = useState(0)
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pairRef = useRef({ debtToken, collateralToken })
  pairRef.current = { debtToken, collateralToken }

  const fetchPage = useCallback(async (targetPage: number, reset: boolean) => {
    const { debtToken: dt, collateralToken: ct } = pairRef.current
    if (!dt || !ct) return

    if (reset) setIsLoading(true)
    else setIsLoadingMore(true)
    setError(null)

    try {
      const url = buildApiUrl(`/api/pairs/${dt}-${ct}`, {
        page: targetPage,
        limit: PAIR_LIMIT,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PairListingsResponse

      // Check pair hasn't changed during fetch
      if (pairRef.current.debtToken !== dt || pairRef.current.collateralToken !== ct) return

      const newInscriptions = json.data?.inscriptions ?? []
      const newOrders = json.data?.orders ?? []

      if (reset) {
        setInscriptions(newInscriptions)
        setOrders(newOrders)
      } else {
        setInscriptions((prev) => [...prev, ...newInscriptions])
        setOrders((prev) => [...prev, ...newOrders])
      }

      // Use meta totals if backend provides them, otherwise estimate from data length
      setInscriptionsTotal(json.meta?.inscriptions_total ?? newInscriptions.length)
      setOrdersTotal(json.meta?.orders_total ?? newOrders.length)
      setPage(targetPage)
    } catch (err) {
      if (pairRef.current.debtToken !== dt || pairRef.current.collateralToken !== ct) return
      setError(err instanceof Error ? err : new Error(String(err)))
      if (reset) {
        setInscriptions([])
        setOrders([])
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  const refetch = useCallback(() => {
    setPage(1)
    fetchPage(1, true)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (isLoadingMore || isLoading) return
    fetchPage(page + 1, false)
  }, [isLoadingMore, isLoading, page, fetchPage])

  // Serialize pair key to detect changes
  const pairKey = useMemo(
    () => debtToken && collateralToken ? `${debtToken}-${collateralToken}` : null,
    [debtToken, collateralToken],
  )

  // Initial fetch + pair change
  useEffect(() => {
    if (!pairKey) {
      setInscriptions([])
      setOrders([])
      setIsLoading(false)
      return
    }
    setPage(1)
    fetchPage(1, true)
  }, [pairKey, fetchPage])

  // Refresh interval
  useEffect(() => {
    if (!pairKey) return
    const id = setInterval(() => { refetch() }, 15_000)
    return () => clearInterval(id)
  }, [pairKey, refetch])

  const hasMore = inscriptions.length < inscriptionsTotal || orders.length < ordersTotal
  const total = inscriptionsTotal + ordersTotal
  const loaded = inscriptions.length + orders.length

  return {
    inscriptions,
    orders,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    hasMore,
    total,
    loaded,
    loadMore,
  }
}
