import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { addressSchema } from '@/lib/schemas'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const raw = await params
  const parsed = addressSchema.safeParse(raw)

  if (!parsed.success) {
    return errorResponse('invalid address', 400, request)
  }

  const { address } = parsed.data
  const { searchParams } = request.nextUrl
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page') ?? '1')))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '100')))

  try {
    const db = getD1()
    const { results: balances, total } = await db.getShareBalances(address, page, limit)

    return jsonResponse({
      data: { address, balances },
      meta: { page, limit, total },
    }, request)
  } catch (err) {
    logError('shares/[address]', err)
    return errorResponse('service unavailable', 502, request)
  }
}
