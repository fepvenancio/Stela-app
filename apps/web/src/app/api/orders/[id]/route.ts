import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
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
    return jsonResponse({ data: { ...order as Record<string, unknown>, offers } }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}

export async function DELETE(
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

    const orderRecord = order as Record<string, unknown>
    if (orderRecord.status !== 'pending') {
      return errorResponse('Order is not pending', 400, request)
    }

    // Verify the caller is the borrower who created this order
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const callerAddress = (body.borrower as string) ?? ''

    const normalizeAddr = (a: string) =>
      '0x' + a.replace(/^0x/i, '').toLowerCase().padStart(64, '0')

    const orderBorrower = normalizeAddr(orderRecord.borrower as string)
    const caller = normalizeAddr(callerAddress)

    if (caller !== orderBorrower) {
      return errorResponse('Not authorized to cancel this order', 403, request)
    }

    await db.updateOrderStatus(id, 'cancelled')
    return jsonResponse({ ok: true }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
