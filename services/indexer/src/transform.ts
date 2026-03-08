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
 * Parse the inner calldata of a `settle` call.
 * Layout: InscriptionOrder(11 fields), debt_assets[], interest_assets[], collateral_assets[],
 *         borrower_sig[], LendOffer, lender_sig[], bps(u256)
 */
export function parseSettleCalldata(
  innerCalldata: string[]
): { debt: ParsedAsset[]; interest: ParsedAsset[]; collateral: ParsedAsset[] } | null {
  try {
    // Skip InscriptionOrder struct (11 fields: borrower, debt_hash, interest_hash,
    // collateral_hash, debt_count, interest_count, collateral_count, duration, deadline,
    // multi_lender, nonce)
    const offset = 11

    const { assets: debt, nextOffset: afterDebt } = parseAssetArray(innerCalldata, offset)
    const { assets: interest, nextOffset: afterInterest } = parseAssetArray(innerCalldata, afterDebt)
    const { assets: collateral } = parseAssetArray(innerCalldata, afterInterest)

    return { debt, interest, collateral }
  } catch (err) {
    console.warn('Failed to parse settle calldata:', err)
    return null
  }
}

/**
 * Parse the inner calldata of a `batch_settle` call and return per-order assets.
 * Layout: orders[](InscriptionOrder×N), debt_flat[], interest_flat[], collateral_flat[],
 *         borrower_sigs[][], BatchLendOffer, lender_sig[], bps_list[]
 *
 * Each InscriptionOrder has debt_count, interest_count, collateral_count fields
 * that tell us how to split the flat asset arrays into per-order chunks.
 */
export function parseBatchSettleCalldata(
  innerCalldata: string[]
): { debt: ParsedAsset[]; interest: ParsedAsset[]; collateral: ParsedAsset[] }[] | null {
  try {
    // Parse orders array to get per-order asset counts
    const orderCount = Number(BigInt(innerCalldata[0]))
    let pos = 1

    const orderCounts: { debt: number; interest: number; collateral: number }[] = []
    for (let i = 0; i < orderCount; i++) {
      // InscriptionOrder: borrower(1), debt_hash(1), interest_hash(1), collateral_hash(1),
      //   debt_count(1), interest_count(1), collateral_count(1), duration(1), deadline(1),
      //   multi_lender(1), nonce(1) = 11 fields
      const debtCount = Number(BigInt(innerCalldata[pos + 4]))
      const interestCount = Number(BigInt(innerCalldata[pos + 5]))
      const collateralCount = Number(BigInt(innerCalldata[pos + 6]))
      orderCounts.push({ debt: debtCount, interest: interestCount, collateral: collateralCount })
      pos += 11
    }

    // Parse flat asset arrays
    const { assets: debtFlat, nextOffset: afterDebt } = parseAssetArray(innerCalldata, pos)
    const { assets: interestFlat, nextOffset: afterInterest } = parseAssetArray(innerCalldata, afterDebt)
    const { assets: collateralFlat } = parseAssetArray(innerCalldata, afterInterest)

    // Split flat arrays into per-order chunks
    const results: { debt: ParsedAsset[]; interest: ParsedAsset[]; collateral: ParsedAsset[] }[] = []
    let dIdx = 0, iIdx = 0, cIdx = 0
    for (const counts of orderCounts) {
      results.push({
        debt: debtFlat.slice(dIdx, dIdx + counts.debt),
        interest: interestFlat.slice(iIdx, iIdx + counts.interest),
        collateral: collateralFlat.slice(cIdx, cIdx + counts.collateral),
      })
      dIdx += counts.debt
      iIdx += counts.interest
      cIdx += counts.collateral
    }

    return results
  } catch (err) {
    console.warn('Failed to parse batch_settle calldata:', err)
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

      if (normalizeSelector(selector) === normalizeSelector(createSelector)) {
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
/** Normalize a hex selector to match starknet.js format (strip leading zeros after 0x) */
function normalizeSelector(hex: string): string {
  return '0x' + hex.replace(/^0x0*/, '')
}

export async function transformEvent(
  event: RawStreamEvent,
  blockNumber: number,
  timestamp: number,
  provider: RpcProvider,
  stelaAddress: string,
  abi: unknown[]
): Promise<WebhookEvent | null> {
  const selector = normalizeSelector(event.keys[0])

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

        // Try to parse asset details from tx calldata.
        // Inscriptions can be created via create_inscription, settle, or batch_settle —
        // try each selector as a fallback.
        let assets: {
          debt: ParsedAsset[]
          interest: ParsedAsset[]
          collateral: ParsedAsset[]
        } | null = null

        if (event.transaction?.calldata) {
          // 1. Try create_inscription (direct inscription creation)
          const createSelector = hash.getSelectorFromName('create_inscription')
          const createCd = extractInnerCalldata(event.transaction.calldata, createSelector)
          if (createCd) {
            assets = parseCreateInscriptionCalldata(createCd)
          }

          // 2. Try settle (single off-chain order settlement)
          if (!assets) {
            const settleSelector = hash.getSelectorFromName('settle')
            const settleCd = extractInnerCalldata(event.transaction.calldata, settleSelector)
            if (settleCd) {
              assets = parseSettleCalldata(settleCd)
            }
          }

          // 3. Try batch_settle (multi-order settlement)
          if (!assets) {
            const batchSelector = hash.getSelectorFromName('batch_settle')
            const batchCd = extractInnerCalldata(event.transaction.calldata, batchSelector)
            if (batchCd) {
              const allOrders = parseBatchSettleCalldata(batchCd)
              if (allOrders && allOrders.length > 0) {
                // Match this inscription to the right order using on-chain asset counts
                const dCount = onChain?.debt_asset_count ?? 0
                const iCount = onChain?.interest_asset_count ?? 0
                const cCount = onChain?.collateral_asset_count ?? 0

                const matched = allOrders.find(
                  (o) => o.debt.length === dCount && o.interest.length === iCount && o.collateral.length === cCount
                )
                assets = matched ?? allOrders[0]
              }
            }
          }

          if (!assets) {
            console.warn(`Could not parse assets from calldata for inscription ${inscriptionId}`)
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
