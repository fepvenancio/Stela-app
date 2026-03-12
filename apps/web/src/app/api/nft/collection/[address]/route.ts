import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { ALCHEMY_NFT_BASE } from '@/lib/config'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

/* ── In-memory cache (5-minute TTL) ───────────────────── */

interface CacheEntry {
  data: CollectionMetadata
  expiresAt: number
}

interface CollectionMetadata {
  name: string
  symbol: string
  image: string | null
  totalSupply: string | null
  tokenType: string | null
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { address } = await params

  if (!/^0x[0-9a-fA-F]{1,64}$/.test(address)) {
    return errorResponse('invalid address', 400, request)
  }

  // Check cache
  const cached = cache.get(address.toLowerCase())
  if (cached && Date.now() < cached.expiresAt) {
    return jsonResponse({ data: cached.data }, request)
  }

  const { env } = getCloudflareContext()
  const apiKey = env.ALCHEMY_API_KEY
  if (!apiKey) {
    return errorResponse('NFT API not configured', 503, request)
  }

  try {
    const url = `${ALCHEMY_NFT_BASE}/${apiKey}/getContractMetadata?contractAddress=${address}`
    const res = await fetch(url)

    if (!res.ok) {
      logError('nft/collection', new Error(`Alchemy returned ${res.status}`))
      return errorResponse('upstream API error', 502, request)
    }

    const json = (await res.json()) as Record<string, unknown>

    const openSeaMetadata = json.openSeaMetadata as Record<string, unknown> | undefined
    let image: string | null =
      (openSeaMetadata?.imageUrl as string) ?? (json.image as string) ?? null

    // If no collection image, fetch the first NFT's image as fallback
    if (!image) {
      try {
        const nftsUrl = `${ALCHEMY_NFT_BASE}/${apiKey}/getNFTsForContract?contractAddress=${address}&withMetadata=true&limit=1`
        const nftsRes = await fetch(nftsUrl)
        if (nftsRes.ok) {
          const nftsJson = (await nftsRes.json()) as Record<string, unknown>
          const nfts = (nftsJson.nfts ?? []) as Array<Record<string, unknown>>
          if (nfts.length > 0) {
            const nftImage = nfts[0].image as Record<string, unknown> | undefined
            image = (nftImage?.cachedUrl as string) ?? (nftImage?.originalUrl as string) ?? null
          }
        }
      } catch { /* ignore fallback failure */ }
    }

    const data: CollectionMetadata = {
      name: (json.name as string) ?? '',
      symbol: (json.symbol as string) ?? '',
      image,
      totalSupply: json.totalSupply != null ? String(json.totalSupply) : null,
      tokenType: (json.tokenType as string) ?? null,
    }

    // Store in cache
    cache.set(address.toLowerCase(), { data, expiresAt: Date.now() + CACHE_TTL_MS })

    return jsonResponse({ data }, request)
  } catch (err) {
    logError('nft/collection', err)
    return errorResponse('upstream API error', 502, request)
  }
}
