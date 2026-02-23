import { RpcProvider } from 'starknet'
import { createD1Queries } from '@stela/core'
import type { D1Queries } from '@stela/core'
import type { Env, IndexerEvent } from './types.js'
import { SELECTORS, fetchAllEvents, getBlockTimestamp } from './rpc.js'
import {
  handleCreated,
  handleSigned,
  handleCancelled,
  handleRepaid,
  handleLiquidated,
  handleRedeemed,
  handleTransferSingle,
} from './handlers/index.js'

// Max blocks to process per invocation to stay within Worker 30s CPU limit
const MAX_BLOCK_RANGE = 500

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

type EventHandler = (
  event: IndexerEvent,
  queries: D1Queries,
  provider: RpcProvider,
  stelaAddress: string,
  env: Env
) => Promise<void>

const HANDLER_MAP: Record<string, EventHandler> = {
  [SELECTORS.InscriptionCreated]: handleCreated,
  [SELECTORS.InscriptionSigned]: (e, q, _p, _s, env) => handleSigned(e, q, env),
  [SELECTORS.InscriptionCancelled]: (e, q) => handleCancelled(e, q),
  [SELECTORS.InscriptionRepaid]: (e, q) => handleRepaid(e, q),
  [SELECTORS.InscriptionLiquidated]: (e, q) => handleLiquidated(e, q),
  [SELECTORS.SharesRedeemed]: (e, q) => handleRedeemed(e, q),
  [SELECTORS.TransferSingle]: (e, q) => handleTransferSingle(e, q),
}

// ---------------------------------------------------------------------------
// Main polling logic
// ---------------------------------------------------------------------------

async function pollEvents(env: Env): Promise<void> {
  const queries = createD1Queries(env.DB)
  const provider = new RpcProvider({ nodeUrl: env.RPC_URL })

  // Mark open inscriptions past their deadline as expired (no assets locked)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expired = await queries.expireOpenInscriptions(nowSeconds)
  if (expired > 0) {
    console.log(`Expired ${expired} open inscription(s) past deadline`)
  }

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

  // Track the last block where ALL events processed successfully.
  // Only advance cursor to this point so failed events can be reprocessed.
  let lastSuccessBlock = fromBlock - 1
  let failedCount = 0

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
      await handler(event, queries, provider, env.STELA_ADDRESS, env)
      lastSuccessBlock = raw.block_number
    } catch (err) {
      failedCount++
      const errMsg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err)
      console.error(
        `Error handling event ${selector} in tx ${raw.transaction_hash}:`,
        err
      )
      // Store error details in _meta for remote debugging
      try {
        await queries.setMeta('last_error', JSON.stringify({
          selector,
          tx_hash: raw.transaction_hash,
          block_number: raw.block_number,
          error: errMsg,
          keys: raw.keys,
          data: raw.data,
          timestamp: new Date().toISOString(),
        }))
      } catch { /* ignore meta write errors */ }
      // Stop processing further events — we cannot advance past a failed block
      break
    }
  }

  if (failedCount === 0) {
    // All events processed successfully — safe to advance to the capped end
    await queries.setLastBlock(cappedTo)
    console.log(`Indexed ${rawEvents.length} events, cursor advanced to ${cappedTo}`)
  } else if (lastSuccessBlock >= fromBlock) {
    // Partial success — advance cursor to the block before the first failure
    await queries.setLastBlock(lastSuccessBlock - 1)
    console.log(
      `Partially indexed (${failedCount} failed), cursor advanced to ${lastSuccessBlock - 1}`
    )
  } else {
    // First event failed — do not advance cursor at all
    console.log(`First event failed, cursor NOT advanced (stays at ${lastBlock})`)
  }
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Constant-time string comparison to prevent timing attacks on secret tokens */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  if (bufA.byteLength !== bufB.byteLength) return false
  return crypto.subtle.timingSafeEqual(bufA, bufB)
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

    // Health check endpoint — no internal state leaked
    if (url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    // Manual trigger — secured with shared secret via Authorization header only
    if (url.pathname === '/trigger') {
      if (!env.TRIGGER_SECRET) {
        return Response.json({ error: 'trigger not configured' }, { status: 503 })
      }
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null
      if (!token || !timingSafeEqual(token, env.TRIGGER_SECRET)) {
        return new Response('Forbidden', { status: 403 })
      }
      await pollEvents(env)
      return Response.json({ ok: true, message: 'poll complete' })
    }

    return new Response('stela-indexer', { status: 200 })
  },
}
