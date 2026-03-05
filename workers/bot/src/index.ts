import { Account, RpcProvider, hash } from 'starknet'
import { createD1Queries, toU256, ASSET_TYPE_ENUM } from '@stela/core'
import type { D1Database, AssetType } from '@stela/core'

interface Env {
  DB: D1Database
  STELA_ADDRESS: string
  RPC_URL: string
  BOT_ADDRESS: string
  BOT_PRIVATE_KEY: string
}

const TX_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Asset serialization types (matching stored order_data JSON)
// ---------------------------------------------------------------------------

interface StoredAsset {
  asset_address: string
  asset_type: AssetType
  value: string
  token_id: string
}

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

/** Serialize an asset array into calldata: [len, ...per-asset fields] */
function serializeAssetCalldata(assets: StoredAsset[]): string[] {
  const calldata: string[] = [String(assets.length)]
  for (const asset of assets) {
    const enumVal = ASSET_TYPE_ENUM[asset.asset_type] ?? 0
    const [valueLow, valueHigh] = toU256(BigInt(asset.value))
    const [tokenIdLow, tokenIdHigh] = toU256(BigInt(asset.token_id))
    calldata.push(
      asset.asset_address,
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
function hashAssets(assets: StoredAsset[]): string {
  const elements: string[] = [String(assets.length)]
  for (const asset of assets) {
    elements.push(asset.asset_address)
    elements.push(String(ASSET_TYPE_ENUM[asset.asset_type] ?? 0))
    const [vLow, vHigh] = toU256(BigInt(asset.value))
    elements.push(vLow, vHigh)
    const [tidLow, tidHigh] = toU256(BigInt(asset.token_id))
    elements.push(tidLow, tidHigh)
  }
  return hash.computePoseidonHashOnElements(elements)
}

/** Serialize a signature string "r,s" or JSON [r, s] into calldata: [len, r, s] */
function serializeSignatureCalldata(sig: string): string[] {
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
 */
async function expireStaleNonceOrders(
  provider: RpcProvider,
  contractAddress: string,
  queries: ReturnType<typeof createD1Queries>,
): Promise<number> {
  const pending = await queries.getPendingOrders()
  let expiredCount = 0

  for (const order of pending) {
    try {
      const orderData: OrderData = JSON.parse(order.order_data as string)
      const onChainNonce = await getOnChainNonce(provider, contractAddress, orderData.borrower)
      const orderNonce = BigInt(orderData.nonce)

      if (onChainNonce !== orderNonce) {
        console.log(
          `Expiring order ${order.id}: borrower nonce stale (order=${orderNonce}, on-chain=${onChainNonce})`,
        )
        await queries.updateOrderStatus(order.id as string, 'expired')
        expiredCount++
      }
    } catch (err) {
      // Don't let a single RPC failure block the whole batch
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`Failed to check nonce for order ${order.id}: ${msg}`)
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
  const matched = await queries.getMatchedOrders()

  if (matched.length === 0) {
    console.log('No matched orders to settle')
    return
  }

  console.log(`Found ${matched.length} matched order(s) to settle`)

  for (const { order_id, offer_id } of matched) {
    try {
      const order = await queries.getOrder(order_id) as Record<string, unknown> | null
      if (!order) {
        console.warn(`Order ${order_id} not found, skipping`)
        continue
      }

      const offers = await queries.getOrderOffers(order_id) as Record<string, unknown>[]
      const offer = offers.find((o) => o.id === offer_id) as Record<string, unknown> | undefined
      if (!offer) {
        console.warn(`Offer ${offer_id} not found for order ${order_id}, skipping`)
        continue
      }

      // Parse stored order data
      const orderData: OrderData = JSON.parse(order.order_data as string)

      // Detect private settlement: lender_commitment is non-zero and lender is zero address
      const lenderCommitment = (offer.lender_commitment as string) ?? '0'
      const isPrivateSettle = lenderCommitment !== '0' && lenderCommitment !== '0x0'
        && (offer.lender as string).replace(/^0x0*/i, '') === '0'

      // Pre-settle nonce check: verify both nonces are still valid on-chain
      const borrowerNonce = await getOnChainNonce(provider, contractAddress, orderData.borrower)
      const expectedBorrowerNonce = BigInt(orderData.nonce)

      if (borrowerNonce !== expectedBorrowerNonce) {
        console.warn(
          `Order ${order_id}: borrower nonce stale (on-chain=${borrowerNonce}, order=${expectedBorrowerNonce}). Expiring order.`,
        )
        await queries.updateOrderStatus(order_id, 'expired')
        continue
      }

      // Skip lender nonce check for private settlements (lender is zero address,
      // contract doesn't consume lender nonce in private path)
      if (!isPrivateSettle) {
        const lenderNonce = await getOnChainNonce(provider, contractAddress, offer.lender as string)
        const expectedLenderNonce = BigInt(offer.nonce as string)

        if (lenderNonce !== expectedLenderNonce) {
          console.warn(
            `Order ${order_id}: lender nonce stale (on-chain=${lenderNonce}, offer=${expectedLenderNonce}). Expiring offer.`,
          )
          await queries.updateOfferStatus(offer_id, 'expired')
          continue
        }
      }

      // Compute asset hashes from asset arrays (may not be stored in order_data)
      const debtHash = orderData.debtHash ?? hashAssets(orderData.debtAssets)
      const interestHash = orderData.interestHash ?? hashAssets(orderData.interestAssets)
      const collateralHash = orderData.collateralHash ?? hashAssets(orderData.collateralAssets)

      // Build order struct calldata (11 fields inline):
      // borrower, debt_hash, interest_hash, collateral_hash,
      // debt_count, interest_count, collateral_count,
      // duration, deadline, multi_lender (0/1), nonce
      const orderCalldata: string[] = [
        orderData.borrower,
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

      // Serialize asset arrays
      const debtCalldata = serializeAssetCalldata(orderData.debtAssets)
      const interestCalldata = serializeAssetCalldata(orderData.interestAssets)
      const collateralCalldata = serializeAssetCalldata(orderData.collateralAssets)

      // Serialize borrower signature
      const borrowerSigCalldata = serializeSignatureCalldata(order.borrower_signature as string)

      // Build offer struct calldata (6 fields inline):
      // order_hash, lender, issued_debt_percentage_low, issued_debt_percentage_high, nonce, lender_commitment
      const [bpsLow, bpsHigh] = toU256(BigInt(offer.bps as number))
      const orderHash = orderData.orderHash
      const offerCalldata: string[] = [
        orderHash,
        offer.lender as string,
        bpsLow,
        bpsHigh,
        offer.nonce as string,
        lenderCommitment,
      ]

      // Serialize lender signature
      const lenderSigCalldata = serializeSignatureCalldata(offer.lender_signature as string)

      // Combine all calldata
      const calldata = [
        ...orderCalldata,
        ...debtCalldata,
        ...interestCalldata,
        ...collateralCalldata,
        ...borrowerSigCalldata,
        ...offerCalldata,
        ...lenderSigCalldata,
      ]

      const { transaction_hash } = await account.execute({
        contractAddress,
        entrypoint: 'settle',
        calldata,
      })

      await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)
      console.log(`Settled order ${order_id} with offer ${offer_id}${isPrivateSettle ? ' (private)' : ''}: ${transaction_hash}`)

      // Update statuses on success
      await queries.updateOrderStatus(order_id, 'settled')
      await queries.updateOfferStatus(offer_id, 'settled')

      // Expire sibling orders with the same borrower+nonce (nonce is now consumed)
      const siblingExpired = await queries.expireSiblingOrders(order_id, orderData.borrower, orderData.nonce)
      if (siblingExpired > 0) {
        console.log(`Expired ${siblingExpired} sibling order(s) for borrower ${orderData.borrower} nonce ${orderData.nonce}`)
      }

      // Purge signatures — no longer needed after on-chain verification
      await queries.purgeOrderSignature(order_id)
      await queries.purgeOfferSignature(offer_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to settle order ${order_id}: ${message}`)
      // Leave as 'matched' so it can be retried on the next cron run
    }
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
      const LOCK_TTL_SECONDS = 300 // 5 minutes
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
          console.log(`Found ${candidates.length} candidate(s)`)
          for (const inscription of candidates) {
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
