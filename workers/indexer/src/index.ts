import { RpcProvider, Contract, hash } from 'starknet'
import {
  createD1Queries,
  inscriptionIdToHex,
  fromU256,
  MAX_BPS,
} from '@stela/core'
import type { D1Queries } from '@stela/core'
import stelaAbi from '@stela/core/abi/stela.json'

// Max blocks to process per invocation to stay within Worker 30s CPU limit
const MAX_BLOCK_RANGE = 500

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database
  STELA_ADDRESS: string
  RPC_URL: string
}

// ---------------------------------------------------------------------------
// Event selectors
// ---------------------------------------------------------------------------

const SELECTORS = {
  InscriptionCreated: hash.getSelectorFromName('InscriptionCreated'),
  InscriptionSigned: hash.getSelectorFromName('InscriptionSigned'),
  InscriptionCancelled: hash.getSelectorFromName('InscriptionCancelled'),
  InscriptionRepaid: hash.getSelectorFromName('InscriptionRepaid'),
  InscriptionLiquidated: hash.getSelectorFromName('InscriptionLiquidated'),
  SharesRedeemed: hash.getSelectorFromName('SharesRedeemed'),
} as const

const ALL_SELECTORS = Object.values(SELECTORS)

// ---------------------------------------------------------------------------
// RPC event shape (from starknet.js getEvents)
// ---------------------------------------------------------------------------

interface RpcEvent {
  keys: string[]
  data: string[]
  transaction_hash: string
  block_number: number
  block_hash: string
}

interface GetEventsResult {
  events: RpcEvent[]
  continuation_token?: string
}

// ---------------------------------------------------------------------------
// Enriched event with resolved block timestamp
// ---------------------------------------------------------------------------

interface IndexerEvent {
  keys: string[]
  data: string[]
  transaction_hash: string
  block_number: number
  timestamp: number
}

// ---------------------------------------------------------------------------
// Fetch inscription from contract (for InscriptionCreated)
// ---------------------------------------------------------------------------

interface OnChainInscription {
  multi_lender: boolean
  duration: number
  deadline: number
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
}

async function fetchInscriptionFromContract(
  provider: RpcProvider,
  stelaAddress: string,
  inscriptionId: string
): Promise<OnChainInscription | null> {
  try {
    const contract = new Contract(stelaAbi, stelaAddress, provider)
    const result = await contract.call('get_inscription', [inscriptionId])
    const r = result as Record<string, unknown>

    return {
      multi_lender: Boolean(r.multi_lender),
      duration: Number(BigInt(r.duration as string | bigint)),
      deadline: Number(BigInt(r.deadline as string | bigint)),
      debt_asset_count: Number(r.debt_asset_count),
      interest_asset_count: Number(r.interest_asset_count),
      collateral_asset_count: Number(r.collateral_asset_count),
    }
  } catch (err) {
    console.error(`Failed to fetch inscription ${inscriptionId} from contract:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseInscriptionId(event: IndexerEvent): string {
  return inscriptionIdToHex({
    low: BigInt(event.keys[1]),
    high: BigInt(event.keys[2]),
  })
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCreated(
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

  await queries.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'created',
    tx_hash: event.transaction_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
  })
}

async function handleSigned(event: IndexerEvent, queries: D1Queries): Promise<void> {
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

async function handleRepaid(event: IndexerEvent, queries: D1Queries): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256)
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

async function handleLiquidated(event: IndexerEvent, queries: D1Queries): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256)
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

async function handleCancelled(event: IndexerEvent, queries: D1Queries): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256)
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

async function handleRedeemed(event: IndexerEvent, queries: D1Queries): Promise<void> {
  // keys[0] = selector, keys[1..2] = id (u256), keys[3] = redeemer
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

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

type EventHandler = (
  event: IndexerEvent,
  queries: D1Queries,
  provider: RpcProvider,
  stelaAddress: string
) => Promise<void>

const HANDLER_MAP: Record<string, EventHandler> = {
  [SELECTORS.InscriptionCreated]: handleCreated,
  [SELECTORS.InscriptionSigned]: (e, q) => handleSigned(e, q),
  [SELECTORS.InscriptionCancelled]: (e, q) => handleCancelled(e, q),
  [SELECTORS.InscriptionRepaid]: (e, q) => handleRepaid(e, q),
  [SELECTORS.InscriptionLiquidated]: (e, q) => handleLiquidated(e, q),
  [SELECTORS.SharesRedeemed]: (e, q) => handleRedeemed(e, q),
}

// ---------------------------------------------------------------------------
// Fetch all events with pagination
// ---------------------------------------------------------------------------

async function fetchAllEvents(
  provider: RpcProvider,
  stelaAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<RpcEvent[]> {
  const allEvents: RpcEvent[] = []
  let continuationToken: string | undefined

  do {
    const params: {
      from_block: { block_number: number }
      to_block: { block_number: number }
      address: string
      keys: string[][]
      chunk_size: number
      continuation_token?: string
    } = {
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      address: stelaAddress,
      keys: [ALL_SELECTORS],
      chunk_size: 100,
    }

    if (continuationToken) {
      params.continuation_token = continuationToken
    }

    const result = (await provider.getEvents(params)) as unknown as GetEventsResult
    allEvents.push(...result.events)
    continuationToken = result.continuation_token
  } while (continuationToken)

  return allEvents
}

// ---------------------------------------------------------------------------
// Get block timestamp via RPC (cached per run)
// ---------------------------------------------------------------------------

async function getBlockTimestamp(
  provider: RpcProvider,
  blockNumber: number,
  cache: Map<number, number>
): Promise<number> {
  const cached = cache.get(blockNumber)
  if (cached !== undefined) return cached

  try {
    const block = await provider.getBlockWithTxHashes(blockNumber)
    const ts = block.timestamp
    cache.set(blockNumber, ts)
    return ts
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Main polling logic
// ---------------------------------------------------------------------------

async function pollEvents(env: Env): Promise<void> {
  const queries = createD1Queries(env.DB)
  const provider = new RpcProvider({ nodeUrl: env.RPC_URL })

  const lastBlock = await queries.getLastBlock()
  const fromBlock = lastBlock + 1

  // Get latest block number
  const latestBlock = await provider.getBlock('latest')
  const toBlock = latestBlock.block_number

  if (fromBlock > toBlock) {
    console.log(`No new blocks (last indexed: ${lastBlock}, latest: ${toBlock})`)
    return
  }

  // Cap block range to prevent Worker timeout on large catch-ups
  const cappedTo = Math.min(toBlock, fromBlock + MAX_BLOCK_RANGE - 1)
  if (cappedTo < toBlock) {
    console.log(`Capping range: ${fromBlock}-${cappedTo} (${toBlock - cappedTo} blocks remaining)`)
  }

  console.log(`Polling events from block ${fromBlock} to ${cappedTo}`)

  const rawEvents = await fetchAllEvents(provider, env.STELA_ADDRESS, fromBlock, cappedTo)

  if (rawEvents.length === 0) {
    await queries.setLastBlock(cappedTo)
    console.log(`No events found, cursor advanced to ${cappedTo}`)
    return
  }

  console.log(`Processing ${rawEvents.length} events`)

  // Cache block timestamps to avoid redundant RPC calls
  const timestampCache = new Map<number, number>()

  for (const raw of rawEvents) {
    const selector = raw.keys[0]
    const handler = HANDLER_MAP[selector]
    if (!handler) continue

    // Resolve block timestamp and build enriched event
    const timestamp = await getBlockTimestamp(provider, raw.block_number, timestampCache)
    const event: IndexerEvent = {
      keys: raw.keys,
      data: raw.data,
      transaction_hash: raw.transaction_hash,
      block_number: raw.block_number,
      timestamp,
    }

    try {
      await handler(event, queries, provider, env.STELA_ADDRESS)
    } catch (err) {
      console.error(
        `Error handling event ${selector} in tx ${raw.transaction_hash}:`,
        err
      )
    }
  }

  await queries.setLastBlock(cappedTo)
  console.log(`Indexed ${rawEvents.length} events, cursor advanced to ${cappedTo}`)
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(pollEvents(env))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/health') {
      const queries = createD1Queries(env.DB)
      const lastBlock = await queries.getLastBlock()
      return Response.json({ ok: true, last_block: lastBlock })
    }

    // Manual trigger for testing — only from Cloudflare dashboard / wrangler
    if (url.pathname === '/trigger') {
      // Block external requests — only allow from localhost or Cloudflare internal
      const cfRay = request.headers.get('cf-ray')
      if (cfRay) {
        return new Response('Forbidden', { status: 403 })
      }
      await pollEvents(env)
      return Response.json({ ok: true, message: 'poll complete' })
    }

    return new Response('stela-indexer', { status: 200 })
  },
}
