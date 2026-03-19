'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildApiUrl } from './api'
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
  /** Active (pending/matched) orders where user is borrower -- shown in Borrowing tab */
  borrowingOrders: OrderRow[]
  /** Active (pending/matched) orders where user is lender (has offer) -- shown in Lending tab */
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
const INSCRIPTIONS_LIMIT = 50
const ORDERS_LIMIT = 50
const T1_LIMIT = 50

export function usePortfolio(address: string | undefined): PortfolioData {
  // ── Inscriptions query ──
  const inscriptionsQuery = useQuery({
    queryKey: queryKeys.portfolio.inscriptions(address!),
    queryFn: async () => {
      const url = buildApiUrl('/api/inscriptions', { address, limit: INSCRIPTIONS_LIMIT })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as ApiListResponse<InscriptionRow>).data
    },
    enabled: Boolean(address),
    refetchInterval: 30_000,
  })

  // ── Orders query ──
  const ordersQuery = useQuery({
    queryKey: queryKeys.portfolio.orders(address!),
    queryFn: async () => {
      const url = buildApiUrl('/api/orders', { address, status: 'all', limit: ORDERS_LIMIT })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as ApiOrderListResponse).data
    },
    enabled: Boolean(address),
    refetchInterval: 30_000,
  })

  // ── Shares query ──
  const sharesQuery = useQuery({
    queryKey: queryKeys.portfolio.shares(address!),
    queryFn: async () => {
      const res = await fetch(`/api/shares/${address}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as SharesResponse
    },
    enabled: Boolean(address),
  })

  // ── Collection offers query ──
  const collectionOffersQuery = useQuery({
    queryKey: queryKeys.portfolio.collectionOffers(address!),
    queryFn: async () => {
      const url = buildApiUrl('/api/collection-offers', { address, limit: T1_LIMIT })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as ApiListResponse<CollectionOfferRow>).data
    },
    enabled: Boolean(address),
    refetchInterval: 30_000,
  })

  // ── Refinances query ──
  const refinancesQuery = useQuery({
    queryKey: queryKeys.portfolio.refinances(address!),
    queryFn: async () => {
      const url = buildApiUrl('/api/refinances', { address, limit: T1_LIMIT })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as ApiListResponse<RefinanceRow>).data
    },
    enabled: Boolean(address),
    refetchInterval: 30_000,
  })

  // ── Renegotiations query ──
  const renegotiationsQuery = useQuery({
    queryKey: queryKeys.portfolio.renegotiations(address!),
    queryFn: async () => {
      const url = buildApiUrl('/api/renegotiations', { address, limit: T1_LIMIT })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as ApiListResponse<RenegotiationRow>).data
    },
    enabled: Boolean(address),
    refetchInterval: 30_000,
  })

  const allInscriptions = inscriptionsQuery.data ?? []
  const allOrders = ordersQuery.data ?? []
  const sharesRaw = sharesQuery.data
  const collectionOffers = collectionOffersQuery.data ?? []
  const refinanceOffers = refinancesQuery.data ?? []
  const renegotiationsList = renegotiationsQuery.data ?? []

  const isLoading =
    inscriptionsQuery.isLoading ||
    sharesQuery.isLoading ||
    ordersQuery.isLoading ||
    collectionOffersQuery.isLoading ||
    refinancesQuery.isLoading ||
    renegotiationsQuery.isLoading
  const error =
    inscriptionsQuery.error ??
    ordersQuery.error ??
    sharesQuery.error ??
    collectionOffersQuery.error ??
    refinancesQuery.error ??
    renegotiationsQuery.error ??
    null

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
      hasMoreInscriptions: false,
      hasMoreOrders: false,
      loadMoreInscriptions: () => {},
      loadMoreOrders: () => {},
      isLoadingMoreInscriptions: false,
      isLoadingMoreOrders: false,
    }
  }, [
    allInscriptions, sharesRaw, allOrders, collectionOffers, refinanceOffers, renegotiationsList,
    address, isLoading, error,
  ])
}
