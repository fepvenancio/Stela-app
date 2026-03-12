'use client'

import { useMemo } from 'react'
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
}

const ACTIVE_STATUSES = new Set(['open', 'partial', 'filled'])

export function usePortfolio(address: string | undefined): PortfolioData {
  const inscriptionsUrl = address
    ? buildApiUrl('/api/inscriptions', { address, limit: 50 })
    : null
  const sharesUrl = address ? `/api/shares/${address}` : null
  const ordersUrl = address
    ? buildApiUrl('/api/orders', { address, status: 'all', limit: 50 })
    : null
  const collectionOffersUrl = address
    ? buildApiUrl('/api/collection-offers', { address, limit: 50 })
    : null
  const refinancesUrl = address
    ? buildApiUrl('/api/refinances', { address, limit: 50 })
    : null
  const renegotiationsUrl = address
    ? buildApiUrl('/api/renegotiations', { address, limit: 50 })
    : null

  const {
    data: inscriptionsRaw,
    isLoading: insLoading,
    error: insError,
  } = useFetchApi<ApiListResponse<InscriptionRow>>(inscriptionsUrl)

  const {
    data: sharesRaw,
    isLoading: sharesLoading,
    error: sharesError,
  } = useFetchApi<SharesResponse>(sharesUrl)

  const {
    data: ordersRaw,
    isLoading: ordersLoading,
    error: ordersError,
  } = useFetchApi<ApiOrderListResponse>(ordersUrl, undefined, 10_000)

  const {
    data: collectionOffersRaw,
    isLoading: coLoading,
    error: coError,
  } = useFetchApi<ApiListResponse<CollectionOfferRow>>(collectionOffersUrl, undefined, 10_000)

  const {
    data: refinancesRaw,
    isLoading: refiLoading,
    error: refiError,
  } = useFetchApi<ApiListResponse<RefinanceRow>>(refinancesUrl, undefined, 10_000)

  const {
    data: renegotiationsRaw,
    isLoading: renegLoading,
    error: renegError,
  } = useFetchApi<ApiListResponse<RenegotiationRow>>(renegotiationsUrl, undefined, 10_000)

  const isLoading = insLoading || sharesLoading || ordersLoading || coLoading || refiLoading || renegLoading
  const error = insError ?? sharesError ?? ordersError ?? coError ?? refiError ?? renegError

  return useMemo(() => {
    const allInscriptions = inscriptionsRaw?.data ?? []
    const shareBalances = sharesRaw?.data?.balances ?? []
    const allOrders = ordersRaw?.data ?? []

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
    }
  }, [inscriptionsRaw, sharesRaw, ordersRaw, collectionOffersRaw, refinancesRaw, renegotiationsRaw, address, isLoading, error])
}
