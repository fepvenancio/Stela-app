import { hash } from 'starknet'
import { toU256, normalizeAddress } from './u256.js'
import { ASSET_TYPE_ENUM } from './types.js'
import type { AssetType } from './types.js'

export interface StoredAsset {
  asset_address: string
  asset_type: AssetType
  value: string
  token_id: string
}

/** Serialize an asset array into calldata: [len, ...per-asset fields] */
export function serializeAssetCalldata(assets: StoredAsset[]): string[] {
  const calldata: string[] = [String(assets.length)]
  for (const asset of assets) {
    const enumVal = ASSET_TYPE_ENUM[asset.asset_type] ?? 0
    const [valueLow, valueHigh] = toU256(BigInt(asset.value))
    const [tokenIdLow, tokenIdHigh] = toU256(BigInt(asset.token_id))
    calldata.push(
      normalizeAddress(asset.asset_address),
      String(enumVal),
      valueLow,
      valueHigh,
      tokenIdLow,
      tokenIdHigh,
    )
  }
  return calldata
}

/** Hash an array of assets using Poseidon — matches Cairo's hash_assets() */
export function hashAssets(assets: StoredAsset[]): string {
  const elements: string[] = [String(assets.length)]
  for (const asset of assets) {
    elements.push(normalizeAddress(asset.asset_address))
    elements.push(String(ASSET_TYPE_ENUM[asset.asset_type] ?? 0))
    const [vLow, vHigh] = toU256(BigInt(asset.value))
    elements.push(vLow, vHigh)
    const [tidLow, tidHigh] = toU256(BigInt(asset.token_id))
    elements.push(tidLow, tidHigh)
  }
  return hash.computePoseidonHashOnElements(elements)
}

/** Serialize a signature string "r,s" or JSON [r, s] into calldata: [len, r, s] */
export function serializeSignatureCalldata(sig: string): string[] {
  let parts: string[]
  if (sig.startsWith('[')) {
    parts = JSON.parse(sig) as string[]
  } else if (sig.startsWith('{')) {
    const obj = JSON.parse(sig) as { r: string; s: string }
    parts = [obj.r, obj.s]
  } else {
    parts = sig.split(',')
  }
  return [String(parts.length), ...parts]
}
