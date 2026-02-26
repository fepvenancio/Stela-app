import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'pending'
  const address = searchParams.get('address') ?? undefined
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20')))

  try {
    const db = getD1()
    const orders = await db.getOrders({ status, address, page, limit })
    return jsonResponse({ data: orders, meta: { page, limit, total: orders.length } }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const db = getD1()
    const body = await request.json() as Record<string, unknown>

    // Validate required fields
    const { id, borrower, order_data, borrower_signature, nonce, deadline } = body
    if (!id || !borrower || !order_data || !borrower_signature || !nonce || !deadline) {
      return errorResponse('Missing required fields', 400, request)
    }

    // Validate deadline is in the future
    const now = Math.floor(Date.now() / 1000)
    if (Number(deadline) <= now) {
      return errorResponse('Deadline must be in the future', 400, request)
    }

    await db.createOrder({
      id: String(id),
      borrower: String(borrower),
      order_data: typeof order_data === 'string' ? order_data : JSON.stringify(order_data),
      borrower_signature: typeof borrower_signature === 'string' ? borrower_signature : JSON.stringify(borrower_signature),
      nonce: String(nonce),
      deadline: Number(deadline),
      created_at: now,
    })

    return jsonResponse({ ok: true, id }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
