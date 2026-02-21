import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions } from '@/lib/api'
import { inscriptionListSchema } from '@/lib/schemas'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = inscriptionListSchema.safeParse(raw)

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'invalid params', 400, request)
  }

  const { status, address, page, limit } = parsed.data

  try {
    const db = getD1()
    const inscriptions = await db.getInscriptions({ status, address, page, limit }) as Record<string, unknown>[]

    // Batch-fetch assets for all returned inscriptions
    const ids = inscriptions.map((i) => i.id as string)
    const allAssets = await db.getAssetsForInscriptions(ids) as Record<string, unknown>[]

    // Group assets by inscription_id
    const assetMap = new Map<string, Record<string, unknown>[]>()
    for (const asset of allAssets) {
      const key = asset.inscription_id as string
      if (!assetMap.has(key)) assetMap.set(key, [])
      assetMap.get(key)!.push(asset)
    }

    // Attach assets to each inscription
    const data = inscriptions.map((i) => ({
      ...i,
      assets: assetMap.get(i.id as string) ?? [],
    }))

    return jsonResponse({
      data,
      meta: { page, limit, total: data.length },
    }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
