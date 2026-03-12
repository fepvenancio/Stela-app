import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const db = getD1()
    const pairs = await db.getPairAggregates()
    return jsonResponse({ data: pairs }, request)
  } catch (err) {
    logError('pairs', err)
    return errorResponse('service unavailable', 502, request)
  }
}
