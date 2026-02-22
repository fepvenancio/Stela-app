'use client'

import { useMemo } from 'react'
import { useFetchApi, buildApiUrl } from './api'
import { computeStatus } from '@/lib/status'
import { addressesEqual } from '@/lib/address'
import { findTokenByAddress } from '@stela/core'
import type { InscriptionRow, AssetRow, ApiListResponse } from '@/types/api'

// -----------------------------------------------------------------------
// API response types for shares / treasury
// -----------------------------------------------------------------------

interface ShareBalance {
  inscription_id: string
  balance: string
}

interface SharesResponse {
  data: { address: string; balances: ShareBalance[] }
}

interface LockedAsset {
  token_address: string
  token_symbol: string
  total_locked: string
  inscriptions: { inscription_id: string; value: string; status: string }[]
}

interface TreasuryResponse {
  data: { address: string; locked_assets: LockedAsset[] }
}

// -----------------------------------------------------------------------
// Enriched inscription with client-side status
// -----------------------------------------------------------------------

export interface EnrichedInscription extends InscriptionRow {
  /** Client-side recomputed status (handles deadline expiry) */
  computedStatus: string
}

// -----------------------------------------------------------------------
// Token amount aggregation
// -----------------------------------------------------------------------

export interface TokenAmount {
  address: string
  symbol: string
  decimals: number
  total: bigint
}

// -----------------------------------------------------------------------
// Summary metrics
// -----------------------------------------------------------------------

export interface PortfolioSummary {
  totalLent: TokenAmount[]
  collateralLocked: TokenAmount[]
  redeemableCount: number
  activeCount: number
}

// -----------------------------------------------------------------------
// Hook return type
// -----------------------------------------------------------------------

export interface PortfolioData {
  lending: EnrichedInscription[]
  borrowing: EnrichedInscription[]
  redeemable: (EnrichedInscription & { shareBalance: string })[]
  summary: PortfolioSummary
  isLoading: boolean
  error: Error | null
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const ACTIVE_STATUSES = new Set(['open', 'partial', 'filled'])

function enrichStatus(row: InscriptionRow): string {
  return computeStatus({
    signed_at: BigInt(row.signed_at ?? '0'),
    duration: BigInt(row.duration),
    issued_debt_percentage: BigInt(row.issued_debt_percentage),
    is_repaid: row.status === 'repaid',
    liquidated: row.status === 'liquidated',
    deadline: BigInt(row.deadline ?? '0'),
    status: row.status,
  })
}

function aggregateDebtAssets(inscriptions: EnrichedInscription[]): TokenAmount[] {
  const map = new Map<string, TokenAmount>()
  for (const ins of inscriptions) {
    const debtAssets = (ins.assets ?? []).filter((a: AssetRow) => a.asset_role === 'debt')
    for (const asset of debtAssets) {
      const key = asset.asset_address.toLowerCase()
      if (!map.has(key)) {
        const token = findTokenByAddress(asset.asset_address)
        map.set(key, {
          address: asset.asset_address,
          symbol: token?.symbol ?? 'UNKNOWN',
          decimals: token?.decimals ?? 18,
          total: 0n,
        })
      }
      const entry = map.get(key)!
      entry.total += BigInt(asset.value ?? '0')
    }
  }
  return Array.from(map.values()).filter((t) => t.total > 0n)
}

// -----------------------------------------------------------------------
// Main hook
// -----------------------------------------------------------------------

export function usePortfolio(address: string | undefined): PortfolioData {
  // Fetch all three APIs in parallel
  const inscriptionsUrl = useMemo(
    () => (address ? buildApiUrl('/api/inscriptions', { address, limit: 100 }) : null),
    [address],
  )
  const sharesUrl = useMemo(
    () => (address ? `/api/shares/${address}` : null),
    [address],
  )
  const treasuryUrl = useMemo(
    () => (address ? `/api/treasury/${address}` : null),
    [address],
  )

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

  const isLoading = insLoading || sharesLoading || treasuryLoading
  const error = insError ?? sharesError ?? treasuryError

  return useMemo(() => {
    const allInscriptions = inscriptionsRaw?.data ?? []
    const shareBalances = sharesRaw?.data?.balances ?? []
    const lockedAssets = treasuryRaw?.data?.locked_assets ?? []

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

    // Categorize
    const lending: EnrichedInscription[] = []
    const borrowing: EnrichedInscription[] = []

    for (const ins of enriched) {
      if (address && ins.lender && addressesEqual(ins.lender, address)) {
        lending.push(ins)
      }
      if (address && ins.borrower && addressesEqual(ins.borrower, address)) {
        borrowing.push(ins)
      }
      // Creator of open inscriptions is the borrower
      if (address && !ins.borrower && addressesEqual(ins.creator, address)) {
        borrowing.push(ins)
      }
    }

    // Redeemable: user has shares > 0 AND status is repaid/liquidated
    const redeemable = enriched
      .filter((ins) => {
        const balance = shareMap.get(ins.id)
        if (!balance || balance === '0') return false
        return ins.computedStatus === 'repaid' || ins.computedStatus === 'liquidated'
      })
      .map((ins) => ({
        ...ins,
        shareBalance: shareMap.get(ins.id) ?? '0',
      }))

    // Summary metrics
    const totalLent = aggregateDebtAssets(lending)

    const collateralLocked: TokenAmount[] = lockedAssets.map((la) => {
      const token = findTokenByAddress(la.token_address)
      return {
        address: la.token_address,
        symbol: la.token_symbol,
        decimals: token?.decimals ?? 18,
        total: BigInt(la.total_locked),
      }
    }).filter((t) => t.total > 0n)

    const redeemableCount = redeemable.length
    const activeCount = enriched.filter((ins) => ACTIVE_STATUSES.has(ins.computedStatus)).length

    return {
      lending,
      borrowing,
      redeemable,
      summary: { totalLent, collateralLocked, redeemableCount, activeCount },
      isLoading,
      error,
    }
  }, [inscriptionsRaw, sharesRaw, treasuryRaw, address, isLoading, error])
}
