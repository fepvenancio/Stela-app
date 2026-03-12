import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { cancelByOwnerSchema } from '@/lib/validation'
import { normalizeAddress } from '@stela/core'

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
    const offer = await db.getCollectionOffer(id)
    if (!offer) return errorResponse('Collection offer not found', 404, request)
    return jsonResponse({ data: offer }, request)
  } catch (err) {
    logError('collection-offers/[id]', err)
    return errorResponse('service unavailable', 502, request)
  }
}

export async function DELETE(
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

    const parsed = cancelByOwnerSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const limited = rateLimit(request, parsed.data.address)
    if (limited) return limited

    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, parsed.data.address)
    if (d1Limited) return d1Limited

    const offer = await db.getCollectionOffer(id)
    if (!offer) return errorResponse('Collection offer not found', 404, request)

    const offerRecord = offer as Record<string, unknown>
    if (offerRecord.status !== 'pending') {
      return errorResponse('Offer is not pending', 400, request)
    }

    if (normalizeAddress(parsed.data.address) !== normalizeAddress(offerRecord.lender as string)) {
      return errorResponse('Not authorized to cancel this offer', 403, request)
    }

    await db.updateCollectionOfferStatus(id, 'cancelled')
    return jsonResponse({ ok: true }, request)
  } catch (err) {
    logError('collection-offers/[id]', err)
    return errorResponse('service unavailable', 502, request)
  }
}
