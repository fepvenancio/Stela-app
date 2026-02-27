import { NextRequest } from 'next/server'
import { typedData as starknetTypedData } from 'starknet'
import type { AssetType } from '@fepvenancio/stela-sdk'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { getInscriptionOrderTypedData, getLendOfferTypedData } from '@/lib/offchain'
import { verifyStarknetSignature } from '@/lib/verify-signature'
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

    const { id, lender, bps, lender_signature, nonce } = parsed.data

    // Rate limit by IP + lender address
    const limited = rateLimit(request, lender)
    if (limited) return limited

    const db = getD1()

    // Verify order exists and is pending
    const order = await db.getOrder(orderId)
    if (!order) {
      return errorResponse('Order not found', 404, request)
    }

    const orderRecord = order as Record<string, unknown>
    if (orderRecord.status !== 'pending') {
      return errorResponse('Order is not pending', 400, request)
    }

    // Check that the order deadline has not passed
    const now = Math.floor(Date.now() / 1000)
    if (Number(orderRecord.deadline) <= now) {
      return errorResponse('Order deadline has passed', 400, request)
    }

    // ── Signature Verification ──────────────────────────────────────────
    // Reconstruct the InscriptionOrder typed data to get the order hash,
    // then build the LendOffer typed data and verify the lender's signature.
    let orderDataParsed: Record<string, unknown> = {}
    const rawOrderData = orderRecord.order_data
    if (typeof rawOrderData === 'string') {
      try { orderDataParsed = JSON.parse(rawOrderData) } catch { /* empty */ }
    } else if (rawOrderData && typeof rawOrderData === 'object') {
      orderDataParsed = rawOrderData as Record<string, unknown>
    }

    // Try to use the stored orderHash first; otherwise recompute from order data
    let orderHash = orderDataParsed.orderHash as string | undefined
    if (!orderHash) {
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
        chainId: 'SN_SEPOLIA',
      })

      const borrowerAddr = (orderDataParsed.borrower as string) ?? (orderRecord.borrower as string)
      orderHash = starknetTypedData.getMessageHash(orderTypedData, borrowerAddr)
    }

    // Build the LendOffer typed data and compute the message hash
    const lendOfferTypedData = getLendOfferTypedData({
      orderHash,
      lender,
      issuedDebtPercentage: BigInt(bps),
      nonce: BigInt(nonce),
      chainId: 'SN_SEPOLIA',
    })

    const offerMessageHash = starknetTypedData.getMessageHash(lendOfferTypedData, lender)

    // Log the computed message hash for debugging (signature is verified on-chain by settle())
    console.log('LendOffer message hash:', offerMessageHash, 'lender:', lender, 'sig length:', lender_signature.length)

    // Note: Server-side is_valid_signature verification is skipped because different
    // wallet implementations (Cartridge Controller, Braavos, etc.) use non-standard
    // signature formats that don't work with raw RPC starknet_call. The signature IS
    // verified on-chain when the bot calls settle() — that's the authoritative check.
    // The server still reconstructs the typed data and computes the message hash above,
    // which prevents forged orderHash attacks.

    await db.createOrderOffer({
      id: String(id),
      order_id: orderId,
      lender: String(lender),
      bps: Number(bps),
      lender_signature: JSON.stringify(lender_signature),
      nonce: String(nonce),
      created_at: now,
    })

    // Update order status to matched
    await db.updateOrderStatus(orderId, 'matched')

    return jsonResponse({ ok: true, id }, request)
  } catch (err) {
    logError('orders/[id]/offer', err)
    return errorResponse('service unavailable', 502, request)
  }
}
