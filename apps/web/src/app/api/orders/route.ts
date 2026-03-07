import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { CHAIN_ID } from '@/lib/config'
import { verifyStarknetSignature } from '@/lib/verify-signature'
import { verifyNonce } from '@/lib/verify-nonce'
import { createOrderParamsSchema, processCreateOrder } from '@stela/core'
import { parseOrderRow } from '@/lib/order-utils'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'pending'
  const address = searchParams.get('address') ?? undefined
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page') ?? '1')))
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

    // Validate input structure
    const parsed = createOrderParamsSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { borrower } = parsed.data

    // Rate limit by IP + borrower address
    const limited = rateLimit(request, borrower)
    if (limited) return limited

    // D1-backed rate limit
    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, borrower)
    if (d1Limited) return d1Limited

    // Delegate to shared Service Layer
    const result = await processCreateOrder(db, parsed.data, {
      chainId: CHAIN_ID,
      verifySignature: verifyStarknetSignature,
      verifyNonce: verifyNonce,
    })

    return jsonResponse({ ok: true, id: result.id, existing: result.existing }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('orders', err)
    return errorResponse(message, 400, request)
  }
}
