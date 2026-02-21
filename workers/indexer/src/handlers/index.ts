import type { RpcProvider } from 'starknet'
import { inscriptionIdToHex, fromU256, MAX_BPS } from '@stela/core'
import type { D1Queries } from '@stela/core'
import type { IndexerEvent, Env } from '../types.js'
import { fetchInscriptionFromContract, fetchLockerAddress } from '../rpc.js'
import { fetchAndStoreAssets, parseInscriptionId } from '../parsers.js'

export async function handleCreated(
  event: IndexerEvent,
  queries: D1Queries,
  provider: RpcProvider,
  stelaAddress: string
): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256), keys[3] = creator
  const inscriptionId = parseInscriptionId(event)
  const creator = event.keys[3]

  const onChain = await fetchInscriptionFromContract(provider, stelaAddress, inscriptionId)

  await queries.upsertInscription({
    id: inscriptionId,
    creator,
    status: 'open',
    issued_debt_percentage: 0,
    multi_lender: onChain?.multi_lender ? 1 : 0,
    duration: onChain?.duration ?? 0,
    deadline: onChain?.deadline ?? 0,
    debt_asset_count: onChain?.debt_asset_count ?? 0,
    interest_asset_count: onChain?.interest_asset_count ?? 0,
    collateral_asset_count: onChain?.collateral_asset_count ?? 0,
    created_at_block: event.block_number,
    created_at_ts: event.timestamp,
    updated_at_ts: event.timestamp,
  })

  // Parse transaction calldata to extract and store asset details
  await fetchAndStoreAssets(provider, event.transaction_hash, inscriptionId, queries)

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'created',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
  })
}

export async function handleSigned(event: IndexerEvent, queries: D1Queries, env?: Env): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256), keys[3] = borrower, keys[4] = lender
  const inscriptionId = parseInscriptionId(event)
  const borrower = event.keys[3]
  const lender = event.keys[4]

  // data[0..1] = issued_debt_percentage (u256), data[2..3] = shares_minted (u256)
  const issuedPercentage = fromU256({
    low: BigInt(event.data[0]),
    high: BigInt(event.data[1]),
  })

  const status = issuedPercentage >= MAX_BPS ? 'filled' : 'partial'

  await queries.upsertInscription({
    id: inscriptionId,
    borrower,
    lender,
    status,
    issued_debt_percentage: Number(issuedPercentage),
    signed_at: event.timestamp,
    updated_at_ts: event.timestamp,
  })

  // Fetch and store the locker TBA address when inscription gets signed
  if (env) {
    try {
      const lockerResult = await fetchLockerAddress(env, inscriptionId)
      if (lockerResult) {
        await queries.upsertLocker(inscriptionId, lockerResult, event.timestamp)
      }
    } catch (err) {
      console.error(`Failed to fetch locker for ${inscriptionId}:`, err)
    }
  }

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'signed',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: {
      borrower,
      lender,
      issued_debt_percentage: issuedPercentage.toString(),
    },
  })
}

export async function handleRepaid(event: IndexerEvent, queries: D1Queries): Promise<void> {
  const inscriptionId = parseInscriptionId(event)
  const repayer = event.data[0]

  await queries.updateInscriptionStatus(inscriptionId, 'repaid', event.timestamp)

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'repaid',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { repayer },
  })
}

export async function handleLiquidated(event: IndexerEvent, queries: D1Queries): Promise<void> {
  const inscriptionId = parseInscriptionId(event)
  const liquidator = event.data[0]

  await queries.updateInscriptionStatus(inscriptionId, 'liquidated', event.timestamp)

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'liquidated',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { liquidator },
  })
}

export async function handleCancelled(event: IndexerEvent, queries: D1Queries): Promise<void> {
  const inscriptionId = parseInscriptionId(event)
  const creator = event.data[0]

  await queries.updateInscriptionStatus(inscriptionId, 'cancelled', event.timestamp)

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'cancelled',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { creator },
  })
}

export async function handleRedeemed(event: IndexerEvent, queries: D1Queries): Promise<void> {
  const inscriptionId = parseInscriptionId(event)
  const redeemer = event.keys[3]

  // data[0..1] = shares (u256)
  const shares = fromU256({
    low: BigInt(event.data[0]),
    high: BigInt(event.data[1]),
  })

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'redeemed',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { redeemer, shares: shares.toString() },
  })
}

export async function handleTransferSingle(event: IndexerEvent, queries: D1Queries): Promise<void> {
  // TransferSingle keys: [selector, operator, from, to]
  // TransferSingle data: [id_low, id_high, value_low, value_high]
  const from = event.keys[2]
  const to = event.keys[3]
  const inscriptionId = inscriptionIdToHex({ low: BigInt(event.data[0]), high: BigInt(event.data[1]) })
  const value = fromU256({ low: BigInt(event.data[2]), high: BigInt(event.data[3]) })

  // Decrement from (unless mint: from = 0x0)
  if (BigInt(from) !== 0n) {
    await queries.decrementShareBalance(from, inscriptionId, value)
  }
  // Increment to (unless burn: to = 0x0)
  if (BigInt(to) !== 0n) {
    await queries.incrementShareBalance(to, inscriptionId, value)
  }
}
