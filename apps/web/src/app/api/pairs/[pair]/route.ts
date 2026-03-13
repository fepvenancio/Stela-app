import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'

/** Validate a hex address string (0x followed by 1-64 hex chars) */
function isValidHex(s: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(s)
}

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pair: string }> }
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { pair } = await params

  // The pair param is "debtToken-collateralToken" (two 0x hex addresses joined by hyphen).
  // Since hex addresses contain hex chars but not hyphens, we split on the first
  // hyphen that follows a hex address pattern: "0x...abc-0x...def"
  // StarkNet addresses are 0x + up to 64 hex chars, so we find the boundary
  // between the two addresses by looking for "-0x" after the first 0x prefix.
  const separatorIdx = pair.indexOf('-0x', 2)
  if (separatorIdx === -1) {
    return errorResponse('invalid pair format, expected debtToken-collateralToken', 400, request)
  }

  const debtToken = pair.slice(0, separatorIdx)
  const collateralToken = pair.slice(separatorIdx + 1)

  if (!isValidHex(debtToken) || !isValidHex(collateralToken)) {
    return errorResponse('invalid token address in pair', 400, request)
  }

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page') ?? '1')))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')))

  try {
    const db = getD1()
    const { inscriptions, orders, meta } = await db.getListingsForPair(debtToken, collateralToken, page, limit)

    return jsonResponse({
      data: {
        debt_token: debtToken,
        collateral_token: collateralToken,
        inscriptions,
        orders,
      },
      meta,
    }, request)
  } catch (err) {
    logError('pairs/[pair]', err)
    return errorResponse('service unavailable', 502, request)
  }
}
