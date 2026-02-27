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

  return {
    ...row,
    order_data: {
      borrower: parsed.borrower ?? '',
      debt_assets: parsed.debt_assets ?? parsed.debtAssets ?? [],
      interest_assets: parsed.interest_assets ?? parsed.interestAssets ?? [],
      collateral_assets: parsed.collateral_assets ?? parsed.collateralAssets ?? [],
      debt_count: parsed.debt_count ?? parsed.debtCount ?? 0,
      interest_count: parsed.interest_count ?? parsed.interestCount ?? 0,
      collateral_count: parsed.collateral_count ?? parsed.collateralCount ?? 0,
      duration: String(parsed.duration ?? '0'),
      deadline: String(parsed.deadline ?? '0'),
      multi_lender: parsed.multi_lender ?? parsed.multiLender ?? false,
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
