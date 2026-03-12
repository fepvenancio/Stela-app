import { Account, RpcProvider } from 'starknet'
import {
  createD1Queries,
  toU256,
  normalizeAddress,
  serializeAssetCalldata,
  hashAssets,
  serializeSignatureCalldata,
} from '@stela/core'
import type { D1Database, StoredAsset } from '@stela/core'

interface Env {
  DB: D1Database
  STELA_ADDRESS: string
  RPC_URL: string
  BOT_ADDRESS: string
  BOT_PRIVATE_KEY: string
}

const TX_TIMEOUT_MS = 120_000
const MAX_LIQUIDATIONS_PER_RUN = 10
const MAX_SETTLEMENTS_PER_RUN = 10

// ---------------------------------------------------------------------------
// Asset serialization types (matching stored order_data JSON)
// ---------------------------------------------------------------------------

interface OrderData {
  borrower: string
  debtAssets: StoredAsset[]
  interestAssets: StoredAsset[]
  collateralAssets: StoredAsset[]
  duration: string
  deadline: string
  multiLender: boolean
  nonce: string
  debtHash: string
  interestHash: string
  collateralHash: string
  /** SNIP-12 message hash of the InscriptionOrder, used as order_hash in settle calldata */
  orderHash: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Transaction timed out after ${ms}ms`)), ms),
    ),
  ])
}

// ---------------------------------------------------------------------------
// Liquidation
// ---------------------------------------------------------------------------

async function liquidate(
  account: Account,
  provider: RpcProvider,
  contractAddress: string,
  inscriptionId: string,
): Promise<string> {
  const { transaction_hash } = await account.execute({
    contractAddress,
    entrypoint: 'liquidate',
    calldata: [...toU256(BigInt(inscriptionId))],
  })

  await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)
  return transaction_hash
}

/** Read the on-chain nonce for an address from the Stela contract */
async function getOnChainNonce(
  provider: RpcProvider,
  contractAddress: string,
  address: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress,
    entrypoint: 'nonces',
    calldata: [address],
  })
  return BigInt(result[0])
}

// ---------------------------------------------------------------------------
// Stale Nonce Expiry
// ---------------------------------------------------------------------------

/**
 * Expire pending orders whose borrower nonce no longer matches on-chain.
 * This happens when the borrower's nonce advances (e.g., another order settled)
 * but the old order remains pending in D1. Such orders can never be settled.
 *
 * Groups orders by borrower to minimize RPC calls (1 per unique borrower).
 */
async function expireStaleNonceOrders(
  provider: RpcProvider,
  contractAddress: string,
  queries: ReturnType<typeof createD1Queries>,
): Promise<number> {
  const pending = await queries.getPendingOrders()
  if (pending.length === 0) return 0

  // Group orders by borrower to batch nonce lookups
  const byBorrower = new Map<string, typeof pending>()
  for (const order of pending) {
    try {
      const raw = order.order_data
      const orderData: OrderData = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw))
      const borrower = normalizeAddress(orderData.borrower)
      const group = byBorrower.get(borrower)
      if (group) group.push(order)
      else byBorrower.set(borrower, [order])
    } catch (err) {
      console.warn(`Failed to parse order_data for order ${order.id}: ${err}`)
    }
  }

  // Fetch nonces in parallel (1 RPC call per unique borrower)
  const nonceResults = await Promise.allSettled(
    Array.from(byBorrower.keys()).map(async (borrower) => ({
      borrower,
      nonce: await getOnChainNonce(provider, contractAddress, borrower),
    })),
  )

  const nonceMap = new Map<string, bigint>()
  for (const result of nonceResults) {
    if (result.status === 'fulfilled') {
      nonceMap.set(result.value.borrower, result.value.nonce)
    }
  }

  let expiredCount = 0
  for (const [borrower, orders] of byBorrower) {
    const onChainNonce = nonceMap.get(borrower)
    if (onChainNonce === undefined) continue // RPC failed for this borrower

    for (const order of orders) {
      try {
        const raw = order.order_data
        const orderData: OrderData = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw))
        const orderNonce = BigInt(orderData.nonce)
        if (onChainNonce !== orderNonce) {
          console.log(
            `Expiring order ${order.id}: borrower nonce stale (order=${orderNonce}, on-chain=${onChainNonce})`,
          )
          await queries.updateOrderStatus(order.id as string, 'expired')
          expiredCount++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`Failed to check nonce for order ${order.id}: ${msg}`)
      }
    }
  }

  return expiredCount
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

async function settleOrders(
  account: Account,
  provider: RpcProvider,
  contractAddress: string,
  queries: ReturnType<typeof createD1Queries>,
): Promise<void> {
  const matched = await queries.getMatchedOrdersFull()

  if (matched.length === 0) {
    console.log('No matched orders to settle')
    return
  }

  console.log(`Found ${matched.length} matched order(s) to settle`)

  const calls: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
  const settledPairs: { order_id: string; offer_id: string; borrower: string; nonce: string }[] = []

  // Pre-fetch all unique nonces in parallel to minimize RPC round-trips
  const uniqueAddresses = new Set<string>()
  for (const row of matched) {
    uniqueAddresses.add(normalizeAddress(row.borrower as string))
    uniqueAddresses.add(normalizeAddress(row.lender as string))
  }
  const nonceResults = await Promise.allSettled(
    Array.from(uniqueAddresses).map(async (addr) => ({
      addr,
      nonce: await getOnChainNonce(provider, contractAddress, addr),
    })),
  )
  const nonceCache = new Map<string, bigint>()
  for (const r of nonceResults) {
    if (r.status === 'fulfilled') nonceCache.set(r.value.addr, r.value.nonce)
  }

  for (const row of matched) {
    const order_id = row.order_id as string
    const offer_id = row.offer_id as string

    try {
      // Parse stored order data
      const rawData = row.order_data
      const orderData: OrderData = JSON.parse(typeof rawData === 'string' ? rawData : JSON.stringify(rawData))

      // Pre-settle nonce check: verify both nonces are still valid on-chain
      const borrowerNonce = nonceCache.get(normalizeAddress(row.borrower as string))
      const expectedBorrowerNonce = BigInt(row.order_nonce as string)

      if (borrowerNonce === undefined) {
        console.warn(`Order ${order_id}: borrower nonce lookup failed, skipping`)
        continue
      }

      if (borrowerNonce !== expectedBorrowerNonce) {
        console.warn(
          `Order ${order_id}: borrower nonce stale (on-chain=${borrowerNonce}, order=${expectedBorrowerNonce}). Expiring order.`,
        )
        await queries.updateOrderStatus(order_id, 'expired')
        continue
      }

      const lenderNonce = nonceCache.get(normalizeAddress(row.lender as string))
      const expectedLenderNonce = BigInt(row.offer_nonce as string)

      if (lenderNonce === undefined) {
        console.warn(`Order ${order_id}: lender nonce lookup failed, skipping`)
        continue
      }

      if (lenderNonce !== expectedLenderNonce) {
        console.warn(
          `Order ${order_id}: lender nonce stale (on-chain=${lenderNonce}, offer=${expectedLenderNonce}). Expiring offer.`,
        )
        await queries.updateOfferStatus(offer_id, 'expired')
        continue
      }

      // Compute asset hashes from asset arrays (may not be stored in order_data)
      const debtHash = orderData.debtHash ?? hashAssets(orderData.debtAssets)
      const interestHash = orderData.interestHash ?? hashAssets(orderData.interestAssets)
      const collateralHash = orderData.collateralHash ?? hashAssets(orderData.collateralAssets)

      // Build order struct calldata
      const orderCalldata: string[] = [
        normalizeAddress(orderData.borrower),
        debtHash,
        interestHash,
        collateralHash,
        String(orderData.debtAssets.length),
        String(orderData.interestAssets.length),
        String(orderData.collateralAssets.length),
        orderData.duration,
        orderData.deadline,
        orderData.multiLender ? '1' : '0',
        orderData.nonce,
      ]

      const debtCalldata = serializeAssetCalldata(orderData.debtAssets)
      const interestCalldata = serializeAssetCalldata(orderData.interestAssets)
      const collateralCalldata = serializeAssetCalldata(orderData.collateralAssets)
      const borrowerSigCalldata = serializeSignatureCalldata(row.borrower_signature as string)

      const [bpsLow, bpsHigh] = toU256(BigInt(row.bps as number))
      const offerCalldata: string[] = [
        orderData.orderHash,
        normalizeAddress(row.lender as string),
        bpsLow,
        bpsHigh,
        row.offer_nonce as string,
      ]

      const lenderSigCalldata = serializeSignatureCalldata(row.lender_signature as string)

      calls.push({
        contractAddress,
        entrypoint: 'settle',
        calldata: [
          ...orderCalldata,
          ...debtCalldata,
          ...interestCalldata,
          ...collateralCalldata,
          ...borrowerSigCalldata,
          ...offerCalldata,
          ...lenderSigCalldata,
        ],
      })
      settledPairs.push({ order_id, offer_id, borrower: row.borrower as string, nonce: row.order_nonce as string })

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to prepare settle for order ${order_id}: ${message}`)
    }
  }

  if (calls.length === 0) return

  // Strategy: try batch first, fall back to individual on failure
  if (calls.length === 1) {
    // Single order — execute directly
    await executeSettlement(account, provider, queries, calls[0], settledPairs[0])
  } else {
    // Batch attempt
    try {
      const { transaction_hash } = await account.execute(calls)
      console.log(`Submitted batch settlement of ${calls.length} orders: ${transaction_hash}`)
      await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)

      await markSettledBatch(queries, settledPairs)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Batch settlement failed (${calls.length} orders): ${message}`)
      console.log('Falling back to individual settlements...')

      // Individual fallback — one bad order won't block the rest
      const fallbackLimit = Math.min(calls.length, MAX_SETTLEMENTS_PER_RUN)
      if (fallbackLimit < calls.length) {
        console.log(
          `Capping individual fallback to ${fallbackLimit} of ${calls.length} settlements`,
        )
      }
      for (let i = 0; i < fallbackLimit; i++) {
        await executeSettlement(account, provider, queries, calls[i], settledPairs[i])
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Settlement helpers
// ---------------------------------------------------------------------------

async function markSettled(
  queries: ReturnType<typeof createD1Queries>,
  pair: { order_id: string; offer_id: string; borrower: string; nonce: string },
) {
  await queries.updateOrderStatus(pair.order_id, 'settled')
  await queries.updateOfferStatus(pair.offer_id, 'settled')
  await queries.expireSiblingOrders(pair.order_id, pair.borrower, pair.nonce)
  await queries.purgeOrderSignature(pair.order_id)
  await queries.purgeOfferSignature(pair.offer_id)
}

/**
 * Batch version of markSettled — uses D1 batch() to execute all post-settlement
 * writes in a single round-trip instead of 5 sequential queries per pair.
 */
async function markSettledBatch(
  queries: ReturnType<typeof createD1Queries>,
  pairs: { order_id: string; offer_id: string; borrower: string; nonce: string }[],
) {
  if (pairs.length === 0) return

  const db = queries.db
  const statements: Parameters<typeof db.batch>[0] = []

  for (const pair of pairs) {
    const normalizedBorrower = normalizeAddress(pair.borrower)

    // 1. Update order status to 'settled'
    statements.push(
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('settled', pair.order_id),
    )
    // 2. Update offer status to 'settled'
    statements.push(
      db.prepare('UPDATE order_offers SET status = ? WHERE id = ?').bind('settled', pair.offer_id),
    )
    // 3. Expire sibling orders with same borrower+nonce
    statements.push(
      db
        .prepare(
          `UPDATE orders SET status = 'expired' WHERE status = 'pending' AND id != ? AND LOWER(borrower) = LOWER(?) AND nonce = ?`,
        )
        .bind(pair.order_id, normalizedBorrower, pair.nonce),
    )
    // 4. Purge borrower signature
    statements.push(
      db.prepare('UPDATE orders SET borrower_signature = NULL WHERE id = ?').bind(pair.order_id),
    )
    // 5. Purge lender signature
    statements.push(
      db
        .prepare('UPDATE order_offers SET lender_signature = NULL WHERE id = ?')
        .bind(pair.offer_id),
    )
  }

  await db.batch(statements)
}

async function executeSettlement(
  account: Account,
  provider: RpcProvider,
  queries: ReturnType<typeof createD1Queries>,
  call: { contractAddress: string; entrypoint: string; calldata: string[] },
  pair: { order_id: string; offer_id: string; borrower: string; nonce: string },
) {
  try {
    const { transaction_hash } = await account.execute(call)
    console.log(`Settled order ${pair.order_id}: ${transaction_hash}`)
    await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)
    await markSettled(queries, pair)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to settle order ${pair.order_id}: ${message}`)
    // Leave as 'matched' — will retry next cron, or expireStaleNonceOrders will catch it
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export default {
  async fetch(): Promise<Response> {
    return new Response('stela-bot', { status: 200 })
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    console.log(`[${new Date().toISOString()}] Bot cron starting...`)

    const queries = createD1Queries(env.DB)

    // Serialize all operations to avoid StarkNet nonce conflicts
    const work = async () => {
      // Acquire a D1-based lock atomically to prevent overlapping cron runs
      const LOCK_KEY = 'bot_lock'
      const LOCK_TTL_SECONDS = 150 // 2.5 minutes (just above 2-min cron interval)
      const acquired = await queries.tryAcquireLock(LOCK_KEY, now, LOCK_TTL_SECONDS)
      if (!acquired) {
        console.log('Skipping: lock held by another instance')
        return
      }

      try {
        const provider = new RpcProvider({ nodeUrl: env.RPC_URL })
        const account = new Account({
          provider,
          address: env.BOT_ADDRESS,
          signer: env.BOT_PRIVATE_KEY,
        })

        // 1. Expire stale orders (past deadline)
        const expired = await queries.expireOrders(now)
        if (expired > 0) {
          console.log(`Expired ${expired} order(s) past deadline`)
        }

        // 1b. Expire orders with stale borrower nonces
        const staleExpired = await expireStaleNonceOrders(provider, env.STELA_ADDRESS, queries)
        if (staleExpired > 0) {
          console.log(`Expired ${staleExpired} order(s) with stale nonces`)
        }

        // 1c. Purge signatures on expired/cancelled orders (no longer needed)
        const purged = await queries.purgeStaleSignatures()
        if (purged > 0) {
          console.log(`Purged signatures from ${purged} stale order/offer row(s)`)
        }

        // 2. Settle matched orders
        await settleOrders(account, provider, env.STELA_ADDRESS, queries)

        // 3. Liquidate expired inscriptions
        console.log('Checking for liquidatable inscriptions...')
        const candidates = await queries.findLiquidatable(now)

        if (candidates.length === 0) {
          console.log('No liquidatable inscriptions found')
        } else {
          const capped = candidates.slice(0, MAX_LIQUIDATIONS_PER_RUN)
          console.log(
            `Found ${candidates.length} candidate(s), processing ${capped.length} this run`,
          )
          for (const inscription of capped) {
            try {
              const txHash = await liquidate(account, provider, env.STELA_ADDRESS, inscription.id)
              console.log(`Liquidated ${inscription.id}: ${txHash}`)
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err)
              console.error(`Failed to liquidate ${inscription.id}: ${message}`)
            }
          }
        }
      } finally {
        // Release lock
        await queries.setMeta(LOCK_KEY, '0').catch(() => {
          // Best-effort lock release; TTL ensures it expires anyway
        })
      }
    }

    ctx.waitUntil(work())
  },
} satisfies ExportedHandler<Env>
