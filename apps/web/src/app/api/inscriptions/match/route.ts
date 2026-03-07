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

    // Enrich with assets
    if (matches.length > 0) {
      const ids = matches.map((m) => m.id)
      const allAssets = await db.getAssetsForInscriptions(ids)

      const assetsByInscription = new Map<string, { debt: unknown[]; interest: unknown[]; collateral: unknown[] }>()
      for (const asset of allAssets) {
        const iid = asset.inscription_id as string
        if (!assetsByInscription.has(iid)) {
          assetsByInscription.set(iid, { debt: [], interest: [], collateral: [] })
        }
        const group = assetsByInscription.get(iid)!
        const role = asset.asset_role as string
        if (role === 'debt') group.debt.push(asset)
        else if (role === 'interest') group.interest.push(asset)
        else if (role === 'collateral') group.collateral.push(asset)
      }

      const enriched = matches.map((m) => {
        const assets = assetsByInscription.get(m.id)
        return {
          ...m,
          debtAssets: assets?.debt ?? [],
          interestAssets: assets?.interest ?? [],
          collateralAssets: assets?.collateral ?? [],
        }
      })

      return jsonResponse({ data: enriched }, request)
    }

    return jsonResponse({ data: matches }, request)
  } catch (err) {
    logError('inscriptions/match', err)
    return errorResponse('service unavailable', 502, request)
  }
}
