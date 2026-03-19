'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useFetchApi, buildApiUrl } from './api'
import { normalizeAddress } from '@/lib/address'
import { enrichStatus } from '@/lib/status'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { InscriptionRow, ApiListResponse, CollectionOfferRow, RefinanceRow, RenegotiationRow } from '@/types/api'
import type { OrderRow } from './useOrders'

// API response types
interface SharesResponse {
  data: {
    address: string
    balances: { inscription_id: string; balance: string }[]
  }
}

interface ApiOrderListResponse {
  data: OrderRow[]
  meta: { page: number; limit: number; total: number }
}

// Exported types
export interface EnrichedInscription extends InscriptionRow {
  computedStatus: string
  pendingShares?: string
}

export interface PortfolioData {
  lending: EnrichedInscription[]
  borrowing: EnrichedInscription[]
  repaid: EnrichedInscription[]
  redeemable: (EnrichedInscription & { shareBalance: string })[]
  orders: OrderRow[]
  /** Active (pending/matched) orders where user is borrower — shown in Borrowing tab */
  borrowingOrders: OrderRow[]
  /** Active (pending/matched) orders where user is lender (has offer) — shown in Lending tab */
  lendingOrders: OrderRow[]
  /** All swap orders (duration=0) */
  swapOrders: OrderRow[]
  /** T1: user's collection offers */
  collectionOffers: CollectionOfferRow[]
  /** T1: user's refinance offers */
  refinanceOffers: RefinanceRow[]
  /** T1: user's renegotiation proposals */
  renegotiations: RenegotiationRow[]
  isLoading: boolean
  error: Error | null
  /** Whether more inscriptions exist beyond what's loaded */
  hasMoreInscriptions: boolean
  /** Whether more orders exist beyond what's loaded */
  hasMoreOrders: boolean
  /** Load next page of inscriptions */
  loadMoreInscriptions: () => void
  /** Load next page of orders */
  loadMoreOrders: () => void
  /** True while loading more inscriptions */
  isLoadingMoreInscriptions: boolean
  /** True while loading more orders */
  isLoadingMoreOrders: boolean
}

const ACTIVE_STATUSES = new Set(['open', 'partial', 'filled'])
const INSCRIPTIONS_LIMIT = 200
const ORDERS_LIMIT = 200
const T1_LIMIT = 100

export function usePortfolio(address: string | undefined): PortfolioData {
  // ── Inscriptions pagination ──
  const [allInscriptions, setAllInscriptions] = useState<InscriptionRow[]>([])
  const [inscriptionsTotal, setInscriptionsTotal] = useState(0)
  const [inscriptionsPage, setInscriptionsPage] = useState(1)
  const [insInitialLoading, setInsInitialLoading] = useState(Boolean(address))
  const [insLoadingMore, setInsLoadingMore] = useState(false)
  const [insError, setInsError] = useState<Error | null>(null)
  const insAddressRef = useRef(address)

  // ── Orders pagination ──
  const [allOrders, setAllOrders] = useState<OrderRow[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersInitialLoading, setOrdersInitialLoading] = useState(Boolean(address))
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false)
  const [ordersError, setOrdersError] = useState<Error | null>(null)
  const ordersAddressRef = useRef(address)

  // ── Fetch inscriptions page ──
  const fetchInscriptionsPage = useCallback(async (page: number, reset: boolean, addr: string) => {
    if (reset) setInsInitialLoading(true)
    else setInsLoadingMore(true)
    setInsError(null)

    try {
      const url = buildApiUrl('/api/inscriptions', { address: addr, limit: INSCRIPTIONS_LIMIT, page })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ApiListResponse<InscriptionRow>
      if (insAddressRef.current !== addr) return
      if (reset) {
        setAllInscriptions(json.data)
      } else {
        setAllInscriptions((prev) => [...prev, ...json.data])
      }
      setInscriptionsTotal(json.meta.total)
      setInscriptionsPage(page)
    } catch (err) {
      if (insAddressRef.current !== addr) return
      setInsError(err instanceof Error ? err : new Error(String(err)))
      if (reset) { setAllInscriptions([]); setInscriptionsTotal(0) }
    } finally {
      setInsInitialLoading(false)
      setInsLoadingMore(false)
    }
  }, [])

  // ── Fetch orders page ──
  const fetchOrdersPage = useCallback(async (page: number, reset: boolean, addr: string) => {
    if (reset) setOrdersInitialLoading(true)
    else setOrdersLoadingMore(true)
    setOrdersError(null)

    try {
      const url = buildApiUrl('/api/orders', { address: addr, status: 'all', limit: ORDERS_LIMIT, page })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ApiOrderListResponse
      if (ordersAddressRef.current !== addr) return
      if (reset) {
        setAllOrders(json.data)
      } else {
        setAllOrders((prev) => [...prev, ...json.data])
      }
      setOrdersTotal(json.meta.total)
      setOrdersPage(page)
    } catch (err) {
      if (ordersAddressRef.current !== addr) return
      setOrdersError(err instanceof Error ? err : new Error(String(err)))
      if (reset) { setAllOrders([]); setOrdersTotal(0) }
    } finally {
      setOrdersInitialLoading(false)
      setOrdersLoadingMore(false)
    }
  }, [])

  // ── Initial fetch + address change ──
  useEffect(() => {
    insAddressRef.current = address
    ordersAddressRef.current = address
    if (!address) {
      setAllInscriptions([])
      setInscriptionsTotal(0)
      setInscriptionsPage(1)
      setInsInitialLoading(false)
      setAllOrders([])
      setOrdersTotal(0)
      setOrdersPage(1)
      setOrdersInitialLoading(false)
      return
    }
    fetchInscriptionsPage(1, true, address)
    fetchOrdersPage(1, true, address)
  }, [address, fetchInscriptionsPage, fetchOrdersPage])

  // ── Orders refresh interval (10s) ──
  useEffect(() => {
    if (!address) return
    const id = setInterval(() => {
      fetchOrdersPage(1, true, address)
    }, 30_000)
    return () => clearInterval(id)
  }, [address, fetchOrdersPage])

  // ── Load more callbacks ──
  const loadMoreInscriptions = useCallback(() => {
    if (insLoadingMore || insInitialLoading || !address) return
    fetchInscriptionsPage(inscriptionsPage + 1, false, address)
  }, [insLoadingMore, insInitialLoading, address, inscriptionsPage, fetchInscriptionsPage])

  const loadMoreOrders = useCallback(() => {
    if (ordersLoadingMore || ordersInitialLoading || !address) return
    fetchOrdersPage(ordersPage + 1, false, address)
  }, [ordersLoadingMore, ordersInitialLoading, address, ordersPage, fetchOrdersPage])

  // ── Shares (no pagination needed) ──
  const sharesUrl = address ? `/api/shares/${address}` : null
  const {
    data: sharesRaw,
    isLoading: sharesLoading,
    error: sharesError,
  } = useFetchApi<SharesResponse>(sharesUrl)

  // ── T1 entities ──
  const collectionOffersUrl = address
    ? buildApiUrl('/api/collection-offers', { address, limit: T1_LIMIT })
    : null
  const refinancesUrl = address
    ? buildApiUrl('/api/refinances', { address, limit: T1_LIMIT })
    : null
  const renegotiationsUrl = address
    ? buildApiUrl('/api/renegotiations', { address, limit: T1_LIMIT })
    : null

  const {
    data: collectionOffersRaw,
    isLoading: coLoading,
    error: coError,
  } = useFetchApi<ApiListResponse<CollectionOfferRow>>(collectionOffersUrl, undefined, 30_000)

  const {
    data: refinancesRaw,
    isLoading: refiLoading,
    error: refiError,
  } = useFetchApi<ApiListResponse<RefinanceRow>>(refinancesUrl, undefined, 30_000)

  const {
    data: renegotiationsRaw,
    isLoading: renegLoading,
    error: renegError,
  } = useFetchApi<ApiListResponse<RenegotiationRow>>(renegotiationsUrl, undefined, 30_000)

  const isLoading = insInitialLoading || sharesLoading || ordersInitialLoading || coLoading || refiLoading || renegLoading
  const error = insError ?? sharesError ?? ordersError ?? coError ?? refiError ?? renegError

  const hasMoreInscriptions = allInscriptions.length < inscriptionsTotal
  const hasMoreOrders = allOrders.length < ordersTotal

  return useMemo(() => {
    const shareBalances = sharesRaw?.data?.balances ?? []

    // Build share balance lookup
    const shareMap = new Map<string, string>()
    for (const sb of shareBalances) {
      shareMap.set(sb.inscription_id, sb.balance)
    }

    // Enrich inscriptions with client-side status
    const enriched: EnrichedInscription[] = allInscriptions.map((row) => ({
      ...row,
      computedStatus: enrichStatus(row),
    }))

    // Single-pass categorization + redeemable
    const lending: EnrichedInscription[] = []
    const borrowing: EnrichedInscription[] = []
    const repaid: EnrichedInscription[] = []
    const redeemable: (EnrichedInscription & { shareBalance: string })[] = []

    for (const ins of enriched) {
      if (!address) continue

      const normLender = ins.lender ? normalizeAddress(ins.lender) : ''
      const normBorrower = ins.borrower ? normalizeAddress(ins.borrower) : ''
      const normCreator = normalizeAddress(ins.creator)

      const isLender = normLender === address
      const isBorrower = normBorrower === address
      const isCreator = normCreator === address
      const balance = shareMap.get(ins.id)

      // Redeemable: user has shares > 0 AND status is liquidated
      if (ins.computedStatus === 'liquidated' && balance && BigInt(balance) > 0n) {
        redeemable.push({ ...ins, shareBalance: balance })
        continue
      }

      if (ins.computedStatus === 'repaid') {
        if (isLender) {
          if (balance && BigInt(balance) > 0n) {
            lending.push({ ...ins, pendingShares: balance })
          } else {
            repaid.push(ins)
          }
        }
        if (isBorrower || (isCreator && !isBorrower)) {
          repaid.push(ins)
        }
        continue
      }

      if (isLender) {
        lending.push(ins)
      }
      if (isBorrower) {
        borrowing.push(ins)
      }
      if (isCreator && ACTIVE_STATUSES.has(ins.computedStatus)) {
        if (!normBorrower || normBorrower !== address) {
          borrowing.push(ins)
        }
      }
    }

    // Helper to check if an order is a swap (duration=0)
    function isSwapOrder(order: OrderRow): boolean {
      const raw: RawOrderData = typeof order.order_data === 'string'
        ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
        : (order.order_data as unknown as RawOrderData) ?? {}
      const data = normalizeOrderData(raw)
      return data.duration === '0'
    }

    // Separate swap orders from lending/borrowing orders
    const swapOrders: OrderRow[] = allOrders.filter((o) =>
      address &&
      (normalizeAddress(o.borrower) === address || o.status === 'settled') &&
      isSwapOrder(o)
    )

    // Split active NON-swap orders into borrowing/lending for display in those tabs
    const activeOrderStatuses = new Set(['pending', 'matched'])
    const borrowingOrders: OrderRow[] = []
    const lendingOrders: OrderRow[] = []
    for (const order of allOrders) {
      if (!activeOrderStatuses.has(order.status)) continue
      if (isSwapOrder(order)) continue // swaps go to their own tab
      if (address && normalizeAddress(order.borrower) === address) {
        borrowingOrders.push(order)
      } else {
        lendingOrders.push(order)
      }
    }

    const collectionOffers = collectionOffersRaw?.data ?? []
    const refinanceOffers = refinancesRaw?.data ?? []
    const renegotiationsList = renegotiationsRaw?.data ?? []

    return {
      lending,
      borrowing,
      repaid,
      redeemable,
      orders: allOrders,
      borrowingOrders,
      lendingOrders,
      swapOrders,
      collectionOffers,
      refinanceOffers,
      renegotiations: renegotiationsList,
      isLoading,
      error,
      hasMoreInscriptions,
      hasMoreOrders,
      loadMoreInscriptions,
      loadMoreOrders,
      isLoadingMoreInscriptions: insLoadingMore,
      isLoadingMoreOrders: ordersLoadingMore,
    }
  }, [
    allInscriptions, sharesRaw, allOrders, collectionOffersRaw, refinancesRaw, renegotiationsRaw,
    address, isLoading, error, hasMoreInscriptions, hasMoreOrders,
    loadMoreInscriptions, loadMoreOrders, insLoadingMore, ordersLoadingMore,
  ])
}
