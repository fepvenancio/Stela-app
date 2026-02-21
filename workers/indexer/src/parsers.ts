import { hash } from 'starknet'
import { inscriptionIdToHex, ASSET_TYPE_NAMES } from '@stela/core'
import type { D1Queries } from '@stela/core'
import type { RpcProvider } from 'starknet'
import type { IndexerEvent, ParsedAsset } from './types.js'

/** Extract the inscription ID (hex) from event keys[1..2] (u256) */
export function parseInscriptionId(event: IndexerEvent): string {
  return inscriptionIdToHex({
    low: BigInt(event.keys[1]),
    high: BigInt(event.keys[2]),
  })
}

/**
 * Parse an Array<Asset> from serialized calldata starting at `offset`.
 * Each Asset = [address, type_enum, value_low, value_high, token_id_low, token_id_high]
 */
export function parseAssetArray(
  calldata: string[],
  offset: number
): { assets: ParsedAsset[]; nextOffset: number } {
  const len = Number(BigInt(calldata[offset]))
  offset++
  const assets: ParsedAsset[] = []
  for (let i = 0; i < len; i++) {
    const asset_address = calldata[offset]
    const asset_type_num = Number(BigInt(calldata[offset + 1]))
    const value_low = BigInt(calldata[offset + 2])
    const value_high = BigInt(calldata[offset + 3])
    const token_id_low = BigInt(calldata[offset + 4])
    const token_id_high = BigInt(calldata[offset + 5])

    const value = (value_high << 128n) | value_low
    const token_id = (token_id_high << 128n) | token_id_low

    assets.push({
      asset_address,
      asset_type: ASSET_TYPE_NAMES[asset_type_num] ?? 'ERC20',
      value: value.toString(),
      token_id: token_id.toString(),
    })
    offset += 6
  }
  return { assets, nextOffset: offset }
}

/**
 * Parse the inner calldata of create_inscription(InscriptionParams).
 * Layout: is_borrow, debt_assets[], interest_assets[], collateral_assets[], duration, deadline, multi_lender
 */
export function parseCreateInscriptionCalldata(innerCalldata: string[]): {
  debt: ParsedAsset[]
  interest: ParsedAsset[]
  collateral: ParsedAsset[]
} | null {
  try {
    let offset = 0
    offset++ // skip is_borrow

    const { assets: debt, nextOffset: o1 } = parseAssetArray(innerCalldata, offset)
    const { assets: interest, nextOffset: o2 } = parseAssetArray(innerCalldata, o1)
    const { assets: collateral } = parseAssetArray(innerCalldata, o2)

    return { debt, interest, collateral }
  } catch {
    return null
  }
}

/**
 * Extract inner calldata from the account's __execute__ transaction calldata.
 * Handles both SNIP-6 (new) and legacy (old) account formats.
 */
export function extractInnerCalldata(calldata: string[], createSelector: string): string[] | null {
  if (!calldata || calldata.length < 5) return null

  // Verify this is a single call to create_inscription
  if (Number(BigInt(calldata[0])) !== 1) return null
  if (BigInt(calldata[2]) !== BigInt(createSelector)) return null

  // SNIP-6 format: [1, to, selector, calldata_len, ...inner_calldata]
  // Legacy format: [1, to, selector, data_offset(0), data_len, total_calldata_len, ...inner_calldata]
  const field3 = BigInt(calldata[3])

  if (field3 === 0n) {
    // Legacy format — data_offset is 0 for single call
    const dataLen = Number(BigInt(calldata[4]))
    if (calldata.length >= 6 + dataLen) {
      return calldata.slice(6, 6 + dataLen)
    }
  } else {
    // SNIP-6 format — field3 is calldata_len
    const calldataLen = Number(field3)
    if (calldata.length >= 4 + calldataLen) {
      return calldata.slice(4, 4 + calldataLen)
    }
  }

  return null
}

/**
 * Fetch the create_inscription transaction, parse its calldata, and store assets in D1.
 */
export async function fetchAndStoreAssets(
  provider: RpcProvider,
  txHash: string,
  inscriptionId: string,
  queries: D1Queries
): Promise<void> {
  try {
    const createSelector = hash.getSelectorFromName('create_inscription')
    const tx = await provider.getTransaction(txHash) as Record<string, unknown>
    const calldata = tx.calldata as string[] | undefined

    if (!calldata) return

    const innerCalldata = extractInnerCalldata(calldata, createSelector)
    if (!innerCalldata) return

    const parsed = parseCreateInscriptionCalldata(innerCalldata)
    if (!parsed) return

    const roles = [
      ['debt', parsed.debt],
      ['interest', parsed.interest],
      ['collateral', parsed.collateral],
    ] as const

    for (const [role, assets] of roles) {
      for (let i = 0; i < assets.length; i++) {
        await queries.insertAsset({
          inscription_id: inscriptionId,
          asset_role: role,
          asset_index: i,
          asset_address: assets[i].asset_address,
          asset_type: assets[i].asset_type,
          value: assets[i].value,
          token_id: assets[i].token_id,
        })
      }
    }

    console.log(
      `Stored ${parsed.debt.length} debt, ${parsed.interest.length} interest, ${parsed.collateral.length} collateral assets for ${inscriptionId}`
    )
  } catch (err) {
    console.error(`Failed to parse/store assets for ${inscriptionId}:`, err)
  }
}
