import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { approveRefinanceSchema } from '@/lib/validation'

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

    const parsed = approveRefinanceSchema.safeParse(body)
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

    const approvalId = crypto.randomUUID()
    const approved = await db.approveRefinance({
      approvalId,
      offerId: id,
      borrower: parsed.data.borrower,
      borrowerSignature: JSON.stringify(parsed.data.borrower_signature),
      nonce: parsed.data.nonce,
    })

    if (!approved) {
      return errorResponse('Offer is no longer pending', 409, request)
    }

    return jsonResponse({ ok: true, id: approvalId }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('refinances/[id]/approve', err)
    return errorResponse(message, 400, request)
  }
}
