import { NextRequest } from 'next/server'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'
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

  try {
    const db = getD1()
    const assets = await db.getLockedAssetsByAddress(address)

    // Group by token address and aggregate values
    const grouped = new Map<string, {
      token_address: string
      token_symbol: string
      total_locked: bigint
      inscriptions: { inscription_id: string; value: string; status: string }[]
    }>()

    for (const asset of assets) {
      const key = asset.asset_address.toLowerCase()
      if (!grouped.has(key)) {
        const token = findTokenByAddress(asset.asset_address)
        grouped.set(key, {
          token_address: asset.asset_address,
          token_symbol: token?.symbol ?? 'UNKNOWN',
          total_locked: 0n,
          inscriptions: [],
        })
      }
      const group = grouped.get(key)!
      const value = BigInt(asset.value || '0')
      group.total_locked += value
      group.inscriptions.push({
        inscription_id: asset.inscription_id,
        value: asset.value,
        status: asset.status,
      })
    }

    const locked_assets = Array.from(grouped.values()).map((g) => ({
      token_address: g.token_address,
      token_symbol: g.token_symbol,
      total_locked: g.total_locked.toString(),
      inscriptions: g.inscriptions,
    }))

    return jsonResponse({
      data: { address, locked_assets },
    }, request)
  } catch (err) {
    console.error('D1 query error:', err instanceof Error ? err.message : String(err))
    return errorResponse('service unavailable', 502, request)
  }
}
