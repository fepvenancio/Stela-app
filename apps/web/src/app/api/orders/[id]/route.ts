import { NextRequest } from 'next/server'
import { typedData as starknetTypedData } from 'starknet'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { getCancelOrderTypedData } from '@/lib/offchain'
import { verifyStarknetSignature } from '@/lib/verify-signature'
import { cancelOrderSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

/** Parse order_data TEXT column into a proper object with normalized keys */
function parseOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  let parsed: Record<string, unknown> = {}
  const raw = row.order_data
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { parsed = {} }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>
  }

  const debtAssets = parsed.debtAssets ?? parsed.debt_assets ?? []
  const interestAssets = parsed.interestAssets ?? parsed.interest_assets ?? []
  const collateralAssets = parsed.collateralAssets ?? parsed.collateral_assets ?? []

  return {
    ...row,
    order_data: {
      borrower: parsed.borrower ?? '',
      debtAssets,
      interestAssets,
      collateralAssets,
      debtCount: (debtAssets as unknown[]).length,
      interestCount: (interestAssets as unknown[]).length,
      collateralCount: (collateralAssets as unknown[]).length,
      duration: String(parsed.duration ?? '0'),
      deadline: String(parsed.deadline ?? '0'),
      multiLender: parsed.multiLender ?? parsed.multi_lender ?? false,
      nonce: String(parsed.nonce ?? row.nonce ?? '0'),
      orderHash: parsed.orderHash ?? undefined,
    },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { id } = await params

  try {
    const db = getD1()
    const order = await db.getOrder(id)

    if (!order) {
      return errorResponse('Order not found', 404, request)
    }

    const offers = await db.getOrderOffers(id)
    const parsed = parseOrderRow(order as Record<string, unknown>)
    return jsonResponse({ data: { ...parsed, offers } }, request)
  } catch (err) {
    logError('orders/[id]', err)
    return errorResponse('service unavailable', 502, request)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    // Parse and validate body
    const rawBody = await request.text()

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('Invalid JSON', 400, request)
    }

    const parsed = cancelOrderSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { borrower: callerAddress, signature } = parsed.data

    // Rate limit by IP + borrower address
    const limited = rateLimit(request, callerAddress)
    if (limited) return limited

    const db = getD1()
    const order = await db.getOrder(id)

    if (!order) {
      return errorResponse('Order not found', 404, request)
    }

    const orderRecord = order as Record<string, unknown>
    if (orderRecord.status !== 'pending') {
      return errorResponse('Order is not pending', 400, request)
    }

    // Verify the caller is the borrower who created this order
    const normalizeAddr = (a: string) =>
      '0x' + a.replace(/^0x/i, '').toLowerCase().padStart(64, '0')

    const orderBorrower = normalizeAddr(orderRecord.borrower as string)
    const caller = normalizeAddr(callerAddress)

    if (caller !== orderBorrower) {
      return errorResponse('Not authorized to cancel this order', 403, request)
    }

    // ── Signature Verification ──────────────────────────────────────────
    // Reconstruct the CancelOrder typed data and compute the SNIP-12 message hash.
    // This must match what the frontend signs via account.signMessage().
    const cancelTypedData = getCancelOrderTypedData(id)
    const cancelHash = starknetTypedData.getMessageHash(cancelTypedData, callerAddress)

    // Verify the borrower's cancellation signature on-chain
    const sigValid = await verifyStarknetSignature(callerAddress, cancelHash, signature)
    if (!sigValid) {
      return errorResponse('Invalid cancellation signature', 401, request)
    }

    await db.updateOrderStatus(id, 'cancelled')
    return jsonResponse({ ok: true }, request)
  } catch (err) {
    logError('orders/[id]', err)
    return errorResponse('service unavailable', 502, request)
  }
}
