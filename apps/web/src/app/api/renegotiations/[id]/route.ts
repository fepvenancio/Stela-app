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
    const proposal = await db.getRenegotiation(id)
    if (!proposal) return errorResponse('Renegotiation not found', 404, request)
    return jsonResponse({ data: proposal }, request)
  } catch (err) {
    logError('renegotiations/[id]', err)
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

    const proposal = await db.getRenegotiation(id)
    if (!proposal) return errorResponse('Renegotiation not found', 404, request)

    const record = proposal as Record<string, unknown>
    if (record.status !== 'pending') {
      return errorResponse('Proposal is not pending', 400, request)
    }

    if (normalizeAddress(parsed.data.address) !== normalizeAddress(record.proposer as string)) {
      return errorResponse('Not authorized to cancel this proposal', 403, request)
    }

    await db.updateRenegotiationStatus(id, 'cancelled')
    return jsonResponse({ ok: true }, request)
  } catch (err) {
    logError('renegotiations/[id]', err)
    return errorResponse('service unavailable', 502, request)
  }
}
