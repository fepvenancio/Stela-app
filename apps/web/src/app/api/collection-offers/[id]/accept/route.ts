import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { acceptCollectionOfferSchema } from '@/lib/validation'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const rawBody = await request.text()
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('Invalid JSON', 400, request)
    }

    const parsed = acceptCollectionOfferSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { borrower } = parsed.data

    const limited = rateLimit(request, borrower)
    if (limited) return limited

    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, borrower)
    if (d1Limited) return d1Limited

    const acceptanceId = crypto.randomUUID()
    const accepted = await db.acceptCollectionOffer({
      acceptanceId,
      offerId: id,
      borrower: parsed.data.borrower,
      tokenId: parsed.data.token_id,
      borrowerSignature: JSON.stringify(parsed.data.borrower_signature),
      nonce: parsed.data.nonce,
    })

    if (!accepted) {
      return errorResponse('Offer is no longer pending', 409, request)
    }

    return jsonResponse({ ok: true, id: acceptanceId }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('collection-offers/[id]/accept', err)
    return errorResponse(message, 400, request)
  }
}
