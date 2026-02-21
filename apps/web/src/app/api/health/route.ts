import { getD1, jsonResponse, errorResponse, handleOptions } from '@/lib/api'

export function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  try {
    const db = getD1()
    // Quick connectivity check — no internal state exposed
    await db.getLastBlock()
    return jsonResponse({
      data: { status: 'ok', d1: true },
    })
  } catch {
    return errorResponse('d1 unreachable', 503)
  }
}
