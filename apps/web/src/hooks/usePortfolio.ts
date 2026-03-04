'use client'

import { useMemo } from 'react'
import { useFetchApi, buildApiUrl } from './api'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeAddress } from '@/lib/address'
import { enrichStatus } from '@/lib/status'
import type { InscriptionRow, AssetRow, ApiListResponse } from '@/types/api'
import type { OrderRow } from './useOrders'

// API response types
interface SharesResponse {
  data: {
    address: string
    balances: { inscription_id: string; balance: string }[]
  }
}

interface TreasuryResponse {
  data: {
    address: string
    locked_assets: {
      token_address: string
      token_symbol: string
      total_locked: string
      inscriptions: { inscription_id: string; value: string; status: string }[]
    }[]
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

export interface TokenAmount {
  address: string
  symbol: string
  decimals: number
  total: bigint
}

export interface PortfolioSummary {
  totalLent: TokenAmount[]
  collateralLocked: TokenAmount[]
  redeemableCount: number
  activeCount: number
  orderCount: number
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
  summary: PortfolioSummary
  isLoading: boolean
  error: Error | null
}

const ACTIVE_STATUSES = new Set(['open', 'partial', 'filled'])

function aggregateDebtAssets(inscriptions: EnrichedInscription[]): TokenAmount[] {
  const map = new Map<string, TokenAmount>()
  for (const ins of inscriptions) {
    const debtAssets = (ins.assets ?? []).filter((a: AssetRow) => a.asset_role === 'debt')
    for (const asset of debtAssets) {
      const existing = map.get(asset.asset_address)
      const value = BigInt(asset.value ?? '0')
      if (existing) {
        existing.total += value
      } else {
        const token = findTokenByAddress(asset.asset_address)
        map.set(asset.asset_address, {
          address: asset.asset_address,
          symbol: token?.symbol ?? asset.asset_address.slice(0, 8),
          decimals: token?.decimals ?? 18,
          total: value,
        })
      }
    }
  }
  return Array.from(map.values())
}

export function usePortfolio(address: string | undefined): PortfolioData {
  const inscriptionsUrl = address
    ? buildApiUrl('/api/inscriptions', { address, limit: 50 })
    : null
  const sharesUrl = address ? `/api/shares/${address}` : null
  const treasuryUrl = address ? `/api/treasury/${address}` : null
  const ordersUrl = address
    ? buildApiUrl('/api/orders', { address, status: 'all', limit: 50 })
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
    data: treasuryRaw,
    isLoading: treasuryLoading,
    error: treasuryError,
  } = useFetchApi<TreasuryResponse>(treasuryUrl)

  const {
    data: ordersRaw,
    isLoading: ordersLoading,
    error: ordersError,
  } = useFetchApi<ApiOrderListResponse>(ordersUrl, undefined, 10_000)

  const isLoading = insLoading || sharesLoading || treasuryLoading || ordersLoading
  const error = insError ?? sharesError ?? treasuryError ?? ordersError

  return useMemo(() => {
    const allInscriptions = inscriptionsRaw?.data ?? []
    const shareBalances = sharesRaw?.data?.balances ?? []
    const lockedAssets = treasuryRaw?.data?.locked_assets ?? []
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

    // Summary metrics
    const totalLent = aggregateDebtAssets(lending)

    const collateralLocked: TokenAmount[] = lockedAssets.map((la) => {
      const token = findTokenByAddress(la.token_address)
      return {
        address: la.token_address,
        symbol: token?.symbol ?? la.token_symbol,
        decimals: token?.decimals ?? 18,
        total: BigInt(la.total_locked),
      }
    })

    // Split active orders into borrowing/lending for display in those tabs
    const activeOrderStatuses = new Set(['pending', 'matched'])
    const borrowingOrders: OrderRow[] = []
    const lendingOrders: OrderRow[] = []
    for (const order of allOrders) {
      if (!activeOrderStatuses.has(order.status)) continue
      if (address && normalizeAddress(order.borrower) === address) {
        borrowingOrders.push(order)
      } else {
        lendingOrders.push(order)
      }
    }

    const redeemableCount = redeemable.length
    const activeCount = enriched.filter((ins) => ACTIVE_STATUSES.has(ins.computedStatus)).length
    const orderCount = borrowingOrders.length + lendingOrders.length

    return {
      lending,
      borrowing,
      repaid,
      redeemable,
      orders: allOrders,
      borrowingOrders,
      lendingOrders,
      summary: { totalLent, collateralLocked, redeemableCount, activeCount, orderCount },
      isLoading,
      error,
    }
  }, [inscriptionsRaw, sharesRaw, treasuryRaw, ordersRaw, address, isLoading, error])
}
