import { NextRequest } from 'next/server'
import { typedData as starknetTypedData } from 'starknet'
import type { AssetType } from '@fepvenancio/stela-sdk'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { getInscriptionOrderTypedData, hashAssets } from '@/lib/offchain'
import { verifyStarknetSignature } from '@/lib/verify-signature'
import { verifyNonce } from '@/lib/verify-nonce'
import { createOrderSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

import { parseOrderRow } from '@/lib/order-utils'

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'pending'
  const address = searchParams.get('address') ?? undefined
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))

  try {
    const db = getD1()
    const orders = await db.getOrders({ status, address, page, limit })
    const parsed = (orders as Record<string, unknown>[]).map(parseOrderRow)
    return jsonResponse({ data: parsed, meta: { page, limit, total: parsed.length } }, request)
  } catch (err) {
    logError('orders', err)
    return errorResponse('service unavailable', 502, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('Invalid JSON', 400, request)
    }

    // Validate input structure with Zod
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { id, borrower, order_data, borrower_signature, nonce, deadline } = parsed.data

    // Rate limit by IP + borrower address
    const limited = rateLimit(request, borrower)
    if (limited) return limited

    // Validate deadline is in the future
    const now = Math.floor(Date.now() / 1000)
    if (deadline <= now) {
      return errorResponse('Deadline must be in the future', 400, request)
    }

    // ── Signature Verification ──────────────────────────────────────────
    // Reconstruct the SNIP-12 typed data from the submitted order data and
    // compute the message hash server-side. This prevents an attacker from
    // submitting a forged orderHash that doesn't match the actual data.
    const toSdkAssets = (arr: Array<{ asset_address: string; asset_type: string; value: string; token_id: string }>) =>
      arr.map((a) => ({
        asset_address: a.asset_address,
        asset_type: a.asset_type as AssetType,
        value: BigInt(a.value),
        token_id: BigInt(a.token_id),
      }))

    const sdkDebtAssets = toSdkAssets(order_data.debtAssets)
    const sdkInterestAssets = toSdkAssets(order_data.interestAssets)
    const sdkCollateralAssets = toSdkAssets(order_data.collateralAssets)

    const typedData = getInscriptionOrderTypedData({
      borrower,
      debtAssets: sdkDebtAssets,
      interestAssets: sdkInterestAssets,
      collateralAssets: sdkCollateralAssets,
      debtCount: sdkDebtAssets.length,
      interestCount: sdkInterestAssets.length,
      collateralCount: sdkCollateralAssets.length,
      duration: BigInt(order_data.duration),
      deadline: BigInt(order_data.deadline),
      multiLender: order_data.multiLender,
      nonce: BigInt(order_data.nonce),
      chainId: 'SN_SEPOLIA',
    })

    const messageHash = starknetTypedData.getMessageHash(typedData, borrower)

    // Verify the borrower's signature on-chain via their account contract
    const sigValid = await verifyStarknetSignature(borrower, messageHash, borrower_signature)
    if (!sigValid) {
      return errorResponse('Invalid borrower signature', 401, request)
    }

    // Verify nonce matches current on-chain nonce (prevents stale orders)
    const nonceCheck = await verifyNonce(borrower, BigInt(order_data.nonce))
    if (!nonceCheck.valid) {
      return errorResponse(
        `Nonce mismatch: submitted=${nonceCheck.submitted}, on-chain=${nonceCheck.onChain}. Please refresh and try again.`,
        400,
        request,
      )
    }

    // Check no other pending order exists with the same borrower + nonce
    const db = getD1()
    const existingOrders = await db.getOrders({ status: 'pending', address: borrower, page: 1, limit: 100 })
    const duplicateNonce = (existingOrders as Record<string, unknown>[]).some((o) => {
      const od = typeof o.order_data === 'string' ? JSON.parse(o.order_data as string) : o.order_data
      return String(od?.nonce) === String(order_data.nonce)
    })
    if (duplicateNonce) {
      return errorResponse(
        'A pending order with this nonce already exists. Cancel it first or wait for it to settle.',
        409,
        request,
      )
    }

    // Verify asset hashes if provided (defense in depth)
    if (order_data.debtHash) {
      const serverDebtHash = hashAssets(sdkDebtAssets)
      if (serverDebtHash !== order_data.debtHash) {
        return errorResponse('Debt asset hash mismatch', 400, request)
      }
    }
    if (order_data.interestHash) {
      const serverInterestHash = hashAssets(sdkInterestAssets)
      if (serverInterestHash !== order_data.interestHash) {
        return errorResponse('Interest asset hash mismatch', 400, request)
      }
    }
    if (order_data.collateralHash) {
      const serverCollateralHash = hashAssets(sdkCollateralAssets)
      if (serverCollateralHash !== order_data.collateralHash) {
        return errorResponse('Collateral asset hash mismatch', 400, request)
      }
    }

    // Store the server-computed message hash in the persisted order data
    const orderDataToStore = {
      ...order_data,
      orderHash: messageHash,
    }

    await db.createOrder({
      id: String(id),
      borrower: String(borrower),
      order_data: JSON.stringify(orderDataToStore),
      borrower_signature: JSON.stringify(borrower_signature),
      nonce: String(nonce),
      deadline: Number(deadline),
      created_at: now,
    })

    return jsonResponse({ ok: true, id }, request)
  } catch (err) {
    logError('orders', err)
    return errorResponse('service unavailable', 502, request)
  }
}
