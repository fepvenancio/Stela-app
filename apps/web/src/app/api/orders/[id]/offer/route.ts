import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { id: orderId } = await params

  try {
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

    const body = await request.json() as Record<string, unknown>
    const { id, lender, bps, lender_signature, nonce } = body

    if (!id || !lender || !bps || !lender_signature || !nonce) {
      return errorResponse('Missing required fields', 400, request)
    }

    if (Number(bps) < 1 || Number(bps) > 10000) {
      return errorResponse('BPS must be between 1 and 10000', 400, request)
    }

    await db.createOrderOffer({
      id: String(id),
      order_id: orderId,
      lender: String(lender),
      bps: Number(bps),
      lender_signature: typeof lender_signature === 'string' ? lender_signature : JSON.stringify(lender_signature),
      nonce: String(nonce),
      created_at: now,
    })

    // Update order status to matched
    await db.updateOrderStatus(orderId, 'matched')

    return jsonResponse({ ok: true, id }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
