import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { createCollectionOfferSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'pending'
  const collection = searchParams.get('collection') ?? undefined
  const lender = searchParams.get('lender') ?? undefined
  const address = searchParams.get('address') ?? undefined
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page') ?? '1')))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))

  try {
    const db = getD1()
    const [offers, total] = await Promise.all([
      db.getCollectionOffers({ status, collection, lender, address, page, limit }),
      db.countCollectionOffers({ status, collection, lender, address }),
    ])
    return jsonResponse({ data: offers, meta: { page, limit, total } }, request)
  } catch (err) {
    logError('collection-offers', err)
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

    const parsed = createCollectionOfferSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { lender } = parsed.data

    const limited = rateLimit(request, lender)
    if (limited) return limited

    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, lender)
    if (d1Limited) return d1Limited

    await db.createCollectionOffer({
      id: parsed.data.id,
      lender: parsed.data.lender,
      collection_address: parsed.data.collection_address,
      order_data: typeof parsed.data.order_data === 'string' ? parsed.data.order_data : JSON.stringify(parsed.data.order_data),
      lender_signature: JSON.stringify(parsed.data.lender_signature),
      nonce: parsed.data.nonce,
      deadline: String(parsed.data.deadline),
      debt_token: parsed.data.debt_token,
      collateral_token: parsed.data.collateral_token,
    })

    return jsonResponse({ ok: true, id: parsed.data.id }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('collection-offers', err)
    return errorResponse(message, 400, request)
  }
}
