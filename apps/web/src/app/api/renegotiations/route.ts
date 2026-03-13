import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import { createRenegotiationSchema } from '@/lib/validation'

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
    const [proposals, total] = await Promise.all([
      db.getRenegotiations({ inscriptionId, address, page, limit }),
      db.countRenegotiations({ inscriptionId, address }),
    ])
    return jsonResponse({ data: proposals, meta: { page, limit, total } }, request)
  } catch (err) {
    logError('renegotiations', err)
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

    const parsed = createRenegotiationSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return errorResponse(`Validation failed: ${messages.join('; ')}`, 400, request)
    }

    const { proposer } = parsed.data

    const limited = rateLimit(request, proposer)
    if (limited) return limited

    const db = getD1()
    const d1Limited = await rateLimitWrite(request, db, proposer)
    if (d1Limited) return d1Limited

    await db.createRenegotiation({
      id: parsed.data.id,
      inscription_id: parsed.data.inscription_id,
      proposer: parsed.data.proposer,
      proposal_data: typeof parsed.data.proposal_data === 'string' ? parsed.data.proposal_data : JSON.stringify(parsed.data.proposal_data),
      proposer_signature: JSON.stringify(parsed.data.proposer_signature),
      nonce: parsed.data.nonce,
      deadline: String(parsed.data.deadline),
    })

    return jsonResponse({ ok: true, id: parsed.data.id }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('renegotiations', err)
    return errorResponse(message, 400, request)
  }
}
