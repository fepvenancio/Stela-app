import { z } from 'zod'
import { typedData as starknetTypedData, hash, shortString } from 'starknet'
import { normalizeAddress, standardizeHex } from '../u256.js'
import { hashAssets } from '../calldata.js'
import type { D1Queries } from '../d1.js'
import type { AssetType } from '../types.js'

// ── Schemas ──────────────────────────────────────────────────────────

export const orderDataSchema = z.object({
  borrower: z.string(),
  debtAssets: z.array(z.object({
    asset_address: z.string(),
    asset_type: z.string(),
    value: z.string(),
    token_id: z.string()
  })),
  interestAssets: z.array(z.object({
    asset_address: z.string(),
    asset_type: z.string(),
    value: z.string(),
    token_id: z.string()
  })),
  collateralAssets: z.array(z.object({
    asset_address: z.string(),
    asset_type: z.string(),
    value: z.string(),
    token_id: z.string()
  })),
  duration: z.string(),
  deadline: z.string(),
  multiLender: z.boolean(),
  nonce: z.string(),
  debtHash: z.string().optional(),
  interestHash: z.string().optional(),
  collateralHash: z.string().optional(),
})

export const createOrderParamsSchema = z.object({
  id: z.string(),
  borrower: z.string(),
  order_data: orderDataSchema,
  borrower_signature: z.array(z.string()),
  nonce: z.string(),
  deadline: z.number(),
})

export type CreateOrderParams = z.infer<typeof createOrderParamsSchema>

// ── Logic ────────────────────────────────────────────────────────────

/**
 * Service to handle order creation logic including server-side validation,
 * signature reconstruction, and idempotency checks.
 */
export async function processCreateOrder(
  db: D1Queries,
  params: CreateOrderParams,
  options: {
    chainId: string
    verifySignature: (address: string, hash: string, sig: string[]) => Promise<boolean>
    verifyNonce: (address: string, nonce: bigint) => Promise<{ valid: boolean; onChain?: bigint; submitted?: bigint }>
  }
) {
  const { id, borrower, order_data, borrower_signature, nonce, deadline } = params
  const now = Math.floor(Date.now() / 1000)

  if (deadline <= now) {
    throw new Error('Deadline must be in the future')
  }

  // Signature reconstruction matches the frontend getInscriptionOrderTypedData
  // but implemented here without external SDK dependency for server-side purity
  const messageHash = computeOrderHash(order_data, options.chainId)

  // Verify signature + nonce in parallel
  const [sigValid, nonceCheck] = await Promise.all([
    options.verifySignature(borrower, messageHash, borrower_signature),
    options.verifyNonce(borrower, BigInt(order_data.nonce)),
  ])

  if (!sigValid) throw new Error('Invalid borrower signature')
  if (!nonceCheck.valid) {
    throw new Error(`Nonce mismatch: submitted=${nonceCheck.submitted}, on-chain=${nonceCheck.onChain ?? 'RPC_FAILED'}`)
  }

  // Idempotency check
  const existingOrders = await db.getOrders({ status: 'pending', address: borrower, page: 1, limit: 100 })
  const existingOrder = (existingOrders as Record<string, unknown>[]).find((o) => {
    const od = typeof o.order_data === 'string' ? JSON.parse(o.order_data as string) : o.order_data
    return od?.orderHash === messageHash
  })
  if (existingOrder) return { id: existingOrder.id, existing: true }

  // Store computed message hash
  const orderDataToStore = { ...order_data, orderHash: messageHash }

  // Denormalized fields
  const debtToken = order_data.debtAssets?.[0]?.asset_address ? normalizeAddress(order_data.debtAssets[0].asset_address) : null
  const collateralToken = order_data.collateralAssets?.[0]?.asset_address ? normalizeAddress(order_data.collateralAssets[0].asset_address) : null
  const durationSeconds = Number(order_data.duration ?? 0)

  await db.createOrder({
    id: String(id),
    borrower: String(borrower),
    order_data: JSON.stringify(orderDataToStore),
    borrower_signature: JSON.stringify(borrower_signature),
    nonce: String(nonce),
    deadline: Number(deadline),
    created_at: now,
    debt_token: debtToken,
    collateral_token: collateralToken,
    duration_seconds: durationSeconds,
  })

  return { id, existing: false }
}

/** Reconstruct SNIP-12 hash server-side */
function computeOrderHash(data: z.infer<typeof orderDataSchema>, chainId: string): string {
  const domain = {
    name: 'Stela',
    version: '1',
    chainId,
  }

  const types = {
    StarkNetDomain: [
      { name: 'name', type: 'felt' },
      { name: 'version', type: 'felt' },
      { name: 'chainId', type: 'felt' },
    ],
    Asset: [
      { name: 'asset', type: 'felt' },
      { name: 'asset_type', type: 'felt' },
      { name: 'value', type: 'u256' },
      { name: 'token_id', type: 'u256' },
    ],
    InscriptionOrder: [
      { name: 'borrower', type: 'felt' },
      { name: 'debt_assets', type: 'Asset*' },
      { name: 'interest_assets', type: 'Asset*' },
      { name: 'collateral_assets', type: 'Asset*' },
      { name: 'debt_count', type: 'felt' },
      { name: 'interest_count', type: 'felt' },
      { name: 'collateral_count', type: 'felt' },
      { name: 'duration', type: 'felt' },
      { name: 'deadline', type: 'felt' },
      { name: 'multi_lender', type: 'felt' },
      { name: 'nonce', type: 'felt' },
    ],
  }

  const toSdkAssets = (arr: any[]) => arr.map(a => ({
    asset: a.asset_address,
    asset_type: a.asset_type,
    value: BigInt(a.value),
    token_id: BigInt(a.token_id)
  }))

  const message = {
    borrower: data.borrower,
    debt_assets: toSdkAssets(data.debtAssets),
    interest_assets: toSdkAssets(data.interestAssets),
    collateral_assets: toSdkAssets(data.collateralAssets),
    debt_count: data.debtAssets.length,
    interest_count: data.interestAssets.length,
    collateral_count: data.collateralAssets.length,
    duration: data.duration,
    deadline: data.deadline,
    multi_lender: data.multiLender ? '1' : '0',
    nonce: data.nonce,
  }

  return starknetTypedData.getMessageHash({ types, primaryType: 'InscriptionOrder', domain, message }, data.borrower)
}
