import { hash } from 'starknet'
import { toU256, fromU256, normalizeAddress, standardizeHex } from './u256.js'
import { ASSET_TYPE_ENUM, ASSET_TYPE_NAMES } from './types.js'
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

/** Parse an asset array from raw RPC calldata */
export function parseAssetArray(
  calldata: string[],
  offset: number,
): { assets: StoredAsset[]; nextOffset: number } {
  const count = Number(BigInt(calldata[offset]))
  let pos = offset + 1
  const assets: StoredAsset[] = []

  for (let i = 0; i < count; i++) {
    const address = normalizeAddress(calldata[pos])
    const typeEnum = Number(BigInt(calldata[pos + 1]))
    const valueLow = BigInt(calldata[pos + 2])
    const valueHigh = BigInt(calldata[pos + 3])
    const tokenIdLow = BigInt(calldata[pos + 4])
    const tokenIdHigh = BigInt(calldata[pos + 5])

    assets.push({
      asset_address: address,
      asset_type: ASSET_TYPE_NAMES[typeEnum] ?? `unknown(${typeEnum})`,
      value: fromU256({ low: valueLow, high: valueHigh }).toString(),
      token_id: fromU256({ low: tokenIdLow, high: tokenIdHigh }).toString(),
    })
    pos += 6
  }

  return { assets, nextOffset: pos }
}

const CREATE_INSCRIPTION_SELECTOR = '0x2c9e2d5cdae3b0cd945fbb8b55cded1be7e4e2e0c648940defcacbc5cbfb9cd'

/** Extract and parse inscription assets from transaction calldata */
export function parseInscriptionCalldata(calldata: string[]): {
  debt: StoredAsset[]
  interest: StoredAsset[]
  collateral: StoredAsset[]
} | null {
  try {
    // 1. Identify if this is a multicall or direct call
    // Simple heuristic: num_calls at index 0
    const numCalls = Number(BigInt(calldata[0]))
    let innerCd: string[] | null = null

    if (numCalls > 0 && numCalls < 100) {
      // Likely multicall: [num_calls, to, selector, data_len, ...data]
      let pos = 1
      for (let i = 0; i < numCalls; i++) {
        const selector = standardizeHex(calldata[pos + 1])
        const cdLen = Number(BigInt(calldata[pos + 2]))
        const cdStart = pos + 3
        if (selector === CREATE_INSCRIPTION_SELECTOR) {
          innerCd = calldata.slice(cdStart, cdStart + cdLen)
          break
        }
        pos = cdStart + cdLen
      }
    } else {
      // Direct call: [params...]
      innerCd = calldata
    }

    if (!innerCd) return null

    // 2. Parse inner calldata
    // Layout: is_borrow (bool), debt_assets (arr), interest_assets (arr), collateral_assets (arr), ...
    let offset = 1 // skip is_borrow
    const { assets: debt, nextOffset: afterDebt } = parseAssetArray(innerCd, offset)
    const { assets: interest, nextOffset: afterInterest } = parseAssetArray(innerCd, afterDebt)
    const { assets: collateral } = parseAssetArray(innerCd, afterInterest)

    return { debt, interest, collateral }
  } catch (err) {
    console.warn('Failed to parse inscription calldata:', err)
    return null
  }
}
