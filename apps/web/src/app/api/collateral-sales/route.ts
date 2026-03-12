import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { createCollateralSaleSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const inscriptionId = searchParams.get('inscription_id') ?? undefined
  const address = searchParams.get('address') ?? undefined
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page') ?? '1')))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))

  try {
    const db = getD1()
    const sales = await db.getCollateralSales({ inscriptionId, address, page, limit })
    return jsonResponse({ data: sales, meta: { page, limit, total: (sales as unknown[]).length } }, request)
  } catch (err) {
    logError('collateral-sales', err)
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

    const parsed = createCollateralSaleSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { buyer } = parsed.data

    const limited = rateLimit(request, buyer)
    if (limited) return limited

    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, buyer)
    if (d1Limited) return d1Limited

    await db.createCollateralSale({
      id: parsed.data.id,
      inscription_id: parsed.data.inscription_id,
      buyer: parsed.data.buyer,
      offer_data: typeof parsed.data.offer_data === 'string' ? parsed.data.offer_data : JSON.stringify(parsed.data.offer_data),
      borrower_signature: JSON.stringify(parsed.data.borrower_signature),
      min_price: parsed.data.min_price,
      deadline: String(parsed.data.deadline),
    })

    return jsonResponse({ ok: true, id: parsed.data.id }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('collateral-sales', err)
    return errorResponse(message, 400, request)
  }
}
