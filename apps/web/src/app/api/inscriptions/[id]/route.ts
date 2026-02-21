import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions } from '@/lib/api'
import { inscriptionIdSchema } from '@/lib/schemas'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const raw = await params
  const parsed = inscriptionIdSchema.safeParse(raw)

  if (!parsed.success) {
    return errorResponse('invalid inscription id', 400, request)
  }

  const { id } = parsed.data

  try {
    const db = getD1()
    const inscription = await db.getInscription(id)

    if (!inscription) {
      return errorResponse('not found', 404, request)
    }

    const assets = await db.getInscriptionAssets(id)

    return jsonResponse({
      data: { ...inscription as Record<string, unknown>, assets },
    }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
