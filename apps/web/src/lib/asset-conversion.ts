/**
 * Shared asset conversion utilities for transforming API/DB asset records
 * into SDK Asset objects.
 *
 * Used by useInstantSettle, useMultiSettle, and useSignOrder hooks.
 */

import type { AssetType, Asset } from '@fepvenancio/stela-sdk'

/**
 * Convert raw asset records (from API/DB JSON) into SDK Asset objects.
 * Handles missing values gracefully by defaulting to '0'.
 */
export function toSdkAssets(arr: Record<string, string>[] | undefined): Asset[] {
  return (arr || []).map((a) => ({
    asset_address: a.asset_address,
    asset_type: a.asset_type as AssetType,
    value: BigInt(a.value || '0'),
    token_id: BigInt(a.token_id ?? '0'),
  }))
}
