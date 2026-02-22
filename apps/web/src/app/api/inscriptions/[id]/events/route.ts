import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'
import { inscriptionIdSchema } from '@/lib/schemas'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const raw = await params
  const parsed = inscriptionIdSchema.safeParse(raw)

  if (!parsed.success) {
    return errorResponse('invalid inscription id', 400, request)
  }

  const { id } = parsed.data

  try {
    const db = getD1()
    const events = await db.getInscriptionEvents(id)

    return jsonResponse({
      data: { events },
    }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
