import { NextRequest } from 'next/server'
import { typedData as starknetTypedData } from 'starknet'
import type { AssetType } from '@fepvenancio/stela-sdk'
import { normalizeAddress } from '@stela/core'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { CHAIN_ID } from '@/lib/config'
import { getInscriptionOrderTypedData, getLendOfferTypedData } from '@/lib/offchain'
import { verifyStarknetSignature } from '@/lib/verify-signature'
import { verifySettleTransaction } from '@/lib/verify-tx'
import { verifyNonce } from '@/lib/verify-nonce'
import { createOfferSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  try {
    const rawBody = await request.text()

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('Invalid JSON', 400, request)
    }

    // Validate input structure with Zod
    const parsed = createOfferSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { id, lender, bps, lender_signature, nonce, tx_hash } = parsed.data

    const rateLimitAddress = lender
    const limited = rateLimit(request, rateLimitAddress)
    if (limited) return limited

    const db = getD1()

    // D1-backed rate limit (persists across cold starts)
    const d1Limited = await rateLimitWrite(request, db, rateLimitAddress)
    if (d1Limited) return d1Limited

    // Verify order exists and is pending
    const order = await db.getOrder(orderId)
    if (!order) {
      return errorResponse('Order not found', 404, request)
    }

    const orderRecord = order as Record<string, unknown>
    if (orderRecord.status !== 'pending') {
      return errorResponse('Order is not pending', 400, request)
    }

    // Self-lending check — lender must not be the borrower
    if (normalizeAddress(lender) === normalizeAddress(orderRecord.borrower as string)) {
      return errorResponse('Cannot lend to your own order', 400, request)
    }

    // Check that the order deadline has not passed
    const now = Math.floor(Date.now() / 1000)
    if (Number(orderRecord.deadline) <= now) {
      return errorResponse('Order deadline has passed', 400, request)
    }

    // If tx_hash is provided, the lender claims to have already settled on-chain.
    // Verify the tx receipt and confirm the lender appears in the settlement event.
    if (tx_hash) {
      const txValid = await verifySettleTransaction(tx_hash, lender)
      if (!txValid) {
        return errorResponse(
          'Transaction not found, did not succeed, or does not match lender on the Stela contract',
          400, request,
        )
      }

      // Ensure this tx_hash hasn't been used for another offer already
      const existingOffers = await db.getOrderOffers(orderId) as Record<string, unknown>[]
      // Also check all orders — tx_hash must be globally unique across offers
      // (a tx that settled order A cannot be reused to mark order B as settled)
      const allOffers = await db.db
        .prepare('SELECT id FROM order_offers WHERE lender_signature = ? LIMIT 1')
        .bind(`"tx:${tx_hash}"`)
        .first()
      if (allOffers) {
        return errorResponse('This transaction hash has already been used', 400, request)
      }
      // Check within this order's existing offers
      for (const existing of existingOffers) {
        if (existing.status === 'settled' || existing.status === 'pending') {
          return errorResponse('This order already has an active offer', 400, request)
        }
      }
    }

    // Verify lender nonce against on-chain (prevents stale offers that can never settle)
    if (!tx_hash) {
      const nonceResult = await verifyNonce(lender, BigInt(nonce))
      if (!nonceResult.valid) {
        return errorResponse(
          `Lender nonce mismatch: submitted ${nonce}, on-chain is ${nonceResult.onChain ?? 'unknown'}`,
          400, request,
        )
      }
    }

    // Verify lender signature (skip only if tx was verified on-chain above)
    if (!tx_hash) {
      const signerAddress = lender

      // ── Signature Verification ──────────────────────────────────────────
      // Reconstruct the InscriptionOrder typed data to get the order hash,
      // then build the LendOffer typed data and verify the signer's signature.
      let orderDataParsed: Record<string, unknown> = {}
      const rawOrderData = orderRecord.order_data
      if (typeof rawOrderData === 'string') {
        try { orderDataParsed = JSON.parse(rawOrderData) } catch { /* empty */ }
      } else if (rawOrderData && typeof rawOrderData === 'object') {
        orderDataParsed = rawOrderData as Record<string, unknown>
      }

      // Always recompute orderHash from order data — never trust stored hashes
      const toSdkAssets = (arr: unknown) => {
        if (!Array.isArray(arr)) return []
        return (arr as Array<Record<string, string>>).map((a) => ({
          asset_address: a.asset_address,
          asset_type: a.asset_type as AssetType,
          value: BigInt(a.value),
          token_id: BigInt(a.token_id ?? '0'),
        }))
      }

      const sdkDebtAssets = toSdkAssets(orderDataParsed.debtAssets ?? orderDataParsed.debt_assets)
      const sdkInterestAssets = toSdkAssets(orderDataParsed.interestAssets ?? orderDataParsed.interest_assets)
      const sdkCollateralAssets = toSdkAssets(orderDataParsed.collateralAssets ?? orderDataParsed.collateral_assets)

      const orderTypedData = getInscriptionOrderTypedData({
        borrower: (orderDataParsed.borrower as string) ?? (orderRecord.borrower as string),
        debtAssets: sdkDebtAssets,
        interestAssets: sdkInterestAssets,
        collateralAssets: sdkCollateralAssets,
        debtCount: sdkDebtAssets.length,
        interestCount: sdkInterestAssets.length,
        collateralCount: sdkCollateralAssets.length,
        duration: BigInt(String(orderDataParsed.duration ?? '0')),
        deadline: BigInt(String(orderDataParsed.deadline ?? '0')),
        multiLender: Boolean(orderDataParsed.multiLender ?? orderDataParsed.multi_lender),
        nonce: BigInt(String(orderDataParsed.nonce ?? orderRecord.nonce ?? '0')),
        chainId: CHAIN_ID,
      })

      const borrowerAddr = (orderDataParsed.borrower as string) ?? (orderRecord.borrower as string)
      const orderHash = starknetTypedData.getMessageHash(orderTypedData, borrowerAddr)

      // Build the LendOffer typed data and compute the message hash.
      const lendOfferTypedData = getLendOfferTypedData({
        orderHash,
        lender,
        issuedDebtPercentage: BigInt(bps),
        nonce: BigInt(nonce),
        chainId: CHAIN_ID,
      })

      const offerMessageHash = starknetTypedData.getMessageHash(lendOfferTypedData, signerAddress)

      // Verify the signer's signature on-chain via their account contract.
      const sigValid = await verifyStarknetSignature(signerAddress, offerMessageHash, lender_signature)
      if (!sigValid) {
        return errorResponse('Invalid lender signature', 401, request)
      }
    }

    // Atomic: create offer + update order status in a single D1 batch transaction.
    // This prevents both the concurrent offer race (M-8) and partial failure orphans.
    const newStatus = tx_hash ? 'settled' : 'matched'
    const sigValue = tx_hash ? `tx:${tx_hash}` : JSON.stringify(lender_signature)
    const offerStatus = tx_hash ? 'settled' : 'pending'

    const batchResult = await db.acceptOffer({
      offerId: String(id),
      orderId,
      lender: String(lender),
      bps: Number(bps),
      lenderSignature: sigValue,
      nonce: String(nonce),
      createdAt: now,
      orderStatus: newStatus,
      offerStatus,
    })

    if (!batchResult) {
      return errorResponse('Order is no longer pending (concurrent offer accepted)', 409, request)
    }

    return jsonResponse({ ok: true, id, status: newStatus }, request)
  } catch (err) {
    logError('orders/[id]/offer', err)
    return errorResponse('service unavailable', 502, request)
  }
}
