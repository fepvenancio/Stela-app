import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions } from '@/lib/api'
import { addressSchema } from '@/lib/schemas'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const raw = await params
  const parsed = addressSchema.safeParse(raw)

  if (!parsed.success) {
    return errorResponse('invalid address', 400, request)
  }

  const { address } = parsed.data

  try {
    const db = getD1()
    const balances = await db.getShareBalances(address)

    return jsonResponse({
      data: { address, balances },
    }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
