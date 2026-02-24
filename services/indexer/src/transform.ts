import { RpcProvider, hash, addAddressPadding } from 'starknet'
import {
  inscriptionIdToHex,
  fromU256,
  MAX_BPS,
  ASSET_TYPE_NAMES,
} from '@stela/core'
import type { WebhookEvent } from '@stela/core'
import {
  SELECTORS,
  fetchInscriptionFromContract,
  fetchLockerAddress,
} from './rpc.js'
import type { ParsedAsset } from './rpc.js'

/** Extract inscription id (u256) from keys[1] and keys[2] as 0x-hex */
export function parseInscriptionId(keys: string[]): string {
  return inscriptionIdToHex({ low: BigInt(keys[1]), high: BigInt(keys[2]) })
}

/**
 * Parse an Array<Asset> from flat calldata starting at `offset`.
 * Layout per asset: [address, type_enum, value_low, value_high, token_id_low, token_id_high]
 * The array is prefixed by its length.
 */
export function parseAssetArray(
  calldata: string[],
  offset: number
): { assets: ParsedAsset[]; nextOffset: number } {
  const count = Number(BigInt(calldata[offset]))
  let pos = offset + 1
  const assets: ParsedAsset[] = []

  for (let i = 0; i < count; i++) {
    const address = addAddressPadding(calldata[pos])
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

/**
 * Parse the inner calldata of a `create_inscription` call.
 * Layout: is_borrow, debt_assets[], interest_assets[], collateral_assets[],
 *         duration, deadline, multi_lender
 */
export function parseCreateInscriptionCalldata(
  innerCalldata: string[]
): { debt: ParsedAsset[]; interest: ParsedAsset[]; collateral: ParsedAsset[] } | null {
  try {
    // Skip is_borrow (1 slot)
    let offset = 1

    const { assets: debt, nextOffset: afterDebt } = parseAssetArray(innerCalldata, offset)
    const { assets: interest, nextOffset: afterInterest } = parseAssetArray(innerCalldata, afterDebt)
    const { assets: collateral } = parseAssetArray(innerCalldata, afterInterest)

    return { debt, interest, collateral }
  } catch (err) {
    console.warn('Failed to parse create_inscription calldata:', err)
    return null
  }
}

/**
 * Extract the inner calldata for a `create_inscription` call from an
 * __execute__ SNIP-6 multicall transaction calldata.
 *
 * Multicall layout: [num_calls, to_1, selector_1, calldata_len_1, ...cd_1, to_2, ...]
 */
export function extractInnerCalldata(
  calldata: string[],
  createSelector: string
): string[] | null {
  try {
    const numCalls = Number(BigInt(calldata[0]))
    let pos = 1

    for (let i = 0; i < numCalls; i++) {
      // to, selector, calldata_len
      const selector = calldata[pos + 1]
      const cdLen = Number(BigInt(calldata[pos + 2]))
      const cdStart = pos + 3

      if (selector === createSelector) {
        return calldata.slice(cdStart, cdStart + cdLen)
      }

      pos = cdStart + cdLen
    }

    return null
  } catch {
    return null
  }
}

export interface RawStreamEvent {
  keys: string[]
  data: string[]
  transactionHash: string
  transaction?: { calldata?: string[] }
}

/**
 * Transform a single raw Starknet event into a WebhookEvent.
 * Returns null if the event selector is unrecognized or parsing fails.
 */
export async function transformEvent(
  event: RawStreamEvent,
  blockNumber: number,
  timestamp: number,
  provider: RpcProvider,
  stelaAddress: string,
  abi: unknown[]
): Promise<WebhookEvent | null> {
  const selector = event.keys[0]

  try {
    switch (selector) {
      case SELECTORS.InscriptionCreated: {
        const inscriptionId = parseInscriptionId(event.keys)
        const creator = event.keys[3]

        // Fetch on-chain inscription data for enrichment
        const onChain = await fetchInscriptionFromContract(
          provider,
          stelaAddress,
          abi,
          inscriptionId
        )

        // Try to parse asset details from tx calldata
        let assets: {
          debt: ParsedAsset[]
          interest: ParsedAsset[]
          collateral: ParsedAsset[]
        } | null = null

        if (event.transaction?.calldata) {
          const createSelector = hash.getSelectorFromName('create_inscription')
          const innerCd = extractInnerCalldata(event.transaction.calldata, createSelector)
          if (innerCd) {
            assets = parseCreateInscriptionCalldata(innerCd)
          }
        }

        return {
          event_type: 'created',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            creator,
            status: 'open',
            multi_lender: onChain?.multi_lender ? 1 : 0,
            duration: onChain?.duration ?? 0,
            deadline: onChain?.deadline ?? 0,
            debt_asset_count: onChain?.debt_asset_count ?? 0,
            interest_asset_count: onChain?.interest_asset_count ?? 0,
            collateral_asset_count: onChain?.collateral_asset_count ?? 0,
            assets: assets ?? { debt: [], interest: [], collateral: [] },
          },
        }
      }

      case SELECTORS.InscriptionSigned: {
        const inscriptionId = parseInscriptionId(event.keys)
        const borrower = event.keys[3]
        const lender = event.keys[4]

        const issuedDebtPct = fromU256({
          low: BigInt(event.data[0]),
          high: BigInt(event.data[1]),
        })
        const shares = fromU256({
          low: BigInt(event.data[2]),
          high: BigInt(event.data[3]),
        })

        const status = issuedDebtPct >= MAX_BPS ? 'filled' : 'partial'

        const lockerAddress = await fetchLockerAddress(
          provider,
          stelaAddress,
          abi,
          inscriptionId
        )

        return {
          event_type: 'signed',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            borrower,
            lender,
            issued_debt_percentage: Number(issuedDebtPct),
            shares: shares.toString(),
            status,
            locker_address: lockerAddress,
          },
        }
      }

      case SELECTORS.InscriptionCancelled: {
        const inscriptionId = parseInscriptionId(event.keys)
        const creator = event.data[0]

        return {
          event_type: 'cancelled',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            creator,
          },
        }
      }

      case SELECTORS.InscriptionRepaid: {
        const inscriptionId = parseInscriptionId(event.keys)
        const repayer = event.data[0]

        return {
          event_type: 'repaid',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            repayer,
          },
        }
      }

      case SELECTORS.InscriptionLiquidated: {
        const inscriptionId = parseInscriptionId(event.keys)
        const liquidator = event.data[0]

        return {
          event_type: 'liquidated',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            liquidator,
          },
        }
      }

      case SELECTORS.SharesRedeemed: {
        const inscriptionId = parseInscriptionId(event.keys)
        const redeemer = event.keys[3]
        const shares = fromU256({
          low: BigInt(event.data[0]),
          high: BigInt(event.data[1]),
        })

        return {
          event_type: 'redeemed',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            redeemer,
            shares: shares.toString(),
          },
        }
      }

      case SELECTORS.TransferSingle: {
        const from = event.keys[2]
        const to = event.keys[3]
        const inscriptionId = inscriptionIdToHex({
          low: BigInt(event.data[0]),
          high: BigInt(event.data[1]),
        })
        const value = fromU256({
          low: BigInt(event.data[2]),
          high: BigInt(event.data[3]),
        })

        return {
          event_type: 'transfer_single',
          tx_hash: event.transactionHash,
          block_number: blockNumber,
          timestamp,
          data: {
            inscription_id: inscriptionId,
            from,
            to,
            value: value.toString(),
          },
        }
      }

      default:
        console.warn(`Unknown event selector: ${selector}`)
        return null
    }
  } catch (err) {
    console.error(`Failed to transform event (selector=${selector}):`, err)
    return null
  }
}
