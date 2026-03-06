import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const debtToken = searchParams.get('debtToken')
  const collateralToken = searchParams.get('collateralToken')
  const duration = searchParams.get('duration')
  const lender = searchParams.get('lender')

  if (!debtToken || !collateralToken || !lender) {
    return errorResponse('Missing required params: debtToken, collateralToken, lender', 400, request)
  }

  // Basic hex address validation
  const hexPattern = /^0x[0-9a-fA-F]+$/
  if (!hexPattern.test(debtToken) || !hexPattern.test(collateralToken) || !hexPattern.test(lender)) {
    return errorResponse('Invalid address format', 400, request)
  }

  try {
    const db = getD1()

    const matches = await db.findCompatibleInscriptions({
      debtToken,
      collateralToken,
      duration: duration ? Number(duration) : undefined,
      excludeBorrower: lender,
      limit: 10,
    })

    return jsonResponse({ data: matches }, request)
  } catch (err) {
    logError('inscriptions/match', err)
    return errorResponse('service unavailable', 502, request)
  }
}
