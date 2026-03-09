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
  const borrower = searchParams.get('borrower')

  if (!debtToken || !collateralToken || !borrower) {
    return errorResponse('Missing required params: debtToken, collateralToken, borrower', 400, request)
  }

  const hexPattern = /^0x[0-9a-fA-F]+$/
  if (!hexPattern.test(debtToken) || !hexPattern.test(collateralToken) || !hexPattern.test(borrower)) {
    return errorResponse('Invalid address format', 400, request)
  }

  try {
    const db = getD1()
    const nowSeconds = Math.floor(Date.now() / 1000)

    const matches = await db.findCompatibleOrders({
      myDebtToken: debtToken,
      myCollateralToken: collateralToken,
      duration: Number(duration ?? '0'),
      borrower,
      nowSeconds,
    })

    // Parse order_data JSON for each match and include borrower_signature
    // (needed by the frontend to build settle() calldata)
    const parsed = matches.map((row) => {
      let orderData: Record<string, unknown> = {}
      const raw = row.order_data
      if (typeof raw === 'string') {
        try { orderData = JSON.parse(raw) } catch { orderData = {} }
      }

      return {
        id: row.id,
        borrower: row.borrower,
        borrower_signature: row.borrower_signature,
        nonce: row.nonce,
        deadline: row.deadline,
        created_at: row.created_at,
        order_data: orderData,
      }
    })

    return jsonResponse({ data: parsed }, request)
  } catch (err) {
    logError('orders/match', err)
    return errorResponse('service unavailable', 502, request)
  }
}
