/**
 * Advanced filter/sort utilities for the browse page.
 *
 * Works with both on-chain inscriptions and off-chain orders
 * by operating on a normalized asset interface.
 */

import { findTokenByAddress } from '@fepvenancio/stela-sdk'

export interface FilterableAsset {
  asset_address: string
  asset_type: string
  value: string | null
}

export interface FilterValues {
  search: string
  debtToken: string
  debtAmount: string
  interestMin: string
  collateralToken: string
}

export const EMPTY_FILTERS: FilterValues = {
  search: '',
  debtToken: '',
  debtAmount: '',
  interestMin: '',
  collateralToken: '',
}

/** Check if any advanced filter is active. */
export function hasActiveFilters(filters: FilterValues): boolean {
  return !!(filters.debtToken || filters.debtAmount || filters.interestMin || filters.collateralToken)
}

/** Check if an item passes the advanced token/amount filters. */
export function passesAdvancedFilters(
  debtAssets: FilterableAsset[],
  interestAssets: FilterableAsset[],
  collateralAssets: FilterableAsset[],
  filters: FilterValues,
): boolean {
  // Debt token filter
  if (filters.debtToken) {
    const match = debtAssets.some((a) => {
      const token = findTokenByAddress(a.asset_address)
      return token?.symbol.toLowerCase() === filters.debtToken.toLowerCase()
    })
    if (!match) return false
  }

  // Collateral token filter
  if (filters.collateralToken) {
    const match = collateralAssets.some((a) => {
      const token = findTokenByAddress(a.asset_address)
      return token?.symbol.toLowerCase() === filters.collateralToken.toLowerCase()
    })
    if (!match) return false
  }

  // Min interest % filter
  if (filters.interestMin) {
    const minPct = parseFloat(filters.interestMin)
    if (!isNaN(minPct) && minPct > 0) {
      const yieldPct = computeYieldPercent(debtAssets, interestAssets)
      if (yieldPct === null || yieldPct < minPct) return false
    }
  }

  return true
}

/** Compute distance of an item's debt from a target amount (for closest-match sort). */
export function computeDebtDistance(
  debtAssets: FilterableAsset[],
  targetAmount: string,
  tokenSymbol: string,
): bigint {
  const target = parseToBigInt(targetAmount)
  if (target === 0n) return 0n

  let total = 0n
  for (const a of debtAssets) {
    const token = findTokenByAddress(a.asset_address)
    if (tokenSymbol && token?.symbol.toLowerCase() !== tokenSymbol.toLowerCase()) continue
    const decimals = token?.decimals ?? 18
    total += BigInt(a.value ?? '0') / (10n ** BigInt(decimals))
  }

  const diff = total - target
  return diff < 0n ? -diff : diff
}

/** Compute yield percentage: (interest / debt * 100). Returns null if no debt. */
export function computeYieldPercent(
  debtAssets: FilterableAsset[],
  interestAssets: FilterableAsset[],
): number | null {
  let debtTotal = 0
  for (const a of debtAssets) {
    const token = findTokenByAddress(a.asset_address)
    const decimals = token?.decimals ?? 18
    debtTotal += Number(BigInt(a.value ?? '0')) / Number(10n ** BigInt(decimals))
  }

  if (debtTotal === 0) return null

  let interestTotal = 0
  for (const a of interestAssets) {
    const token = findTokenByAddress(a.asset_address)
    const decimals = token?.decimals ?? 18
    interestTotal += Number(BigInt(a.value ?? '0')) / Number(10n ** BigInt(decimals))
  }

  return (interestTotal / debtTotal) * 100
}

/** Compute total collateral value (normalized by decimals). */
export function computeCollateralValue(collateralAssets: FilterableAsset[]): number {
  let total = 0
  for (const a of collateralAssets) {
    const token = findTokenByAddress(a.asset_address)
    const decimals = token?.decimals ?? 18
    total += Number(BigInt(a.value ?? '0')) / Number(10n ** BigInt(decimals))
  }
  return total
}

function parseToBigInt(value: string): bigint {
  try {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) return 0n
    return BigInt(Math.floor(num))
  } catch {
    return 0n
  }
}
