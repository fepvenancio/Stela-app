import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { ALCHEMY_NFT_BASE } from '@/lib/config'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

interface NFTItem {
  tokenId: string
  name: string | null
  image: string | null
  collection: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { owner } = await params

  if (!/^0x[0-9a-fA-F]{1,64}$/.test(owner)) {
    return errorResponse('invalid owner address', 400, request)
  }

  const { env } = getCloudflareContext()
  const apiKey = env.ALCHEMY_API_KEY
  if (!apiKey) {
    return errorResponse('NFT API not configured', 503, request)
  }

  const { searchParams } = request.nextUrl
  const collection = searchParams.get('collection')

  try {
    let url = `${ALCHEMY_NFT_BASE}/${apiKey}/getNFTsForOwner?owner=${owner}&withMetadata=true`
    if (collection) {
      url += `&contractAddresses[]=${collection}`
    }

    const res = await fetch(url)

    if (!res.ok) {
      logError('nft/owned', new Error(`Alchemy returned ${res.status}`))
      return errorResponse('upstream API error', 502, request)
    }

    const json = (await res.json()) as Record<string, unknown>
    const ownedNfts = (json.ownedNfts ?? []) as Array<Record<string, unknown>>

    const data: NFTItem[] = ownedNfts.map((nft) => {
      const contract = nft.contract as Record<string, unknown> | undefined
      const image = nft.image as Record<string, unknown> | undefined
      return {
        tokenId: String(nft.tokenId ?? ''),
        name: (nft.name as string) ?? null,
        image: (image?.cachedUrl as string) ?? (image?.originalUrl as string) ?? null,
        collection: (contract?.address as string) ?? '',
      }
    })

    return jsonResponse({ data }, request)
  } catch (err) {
    logError('nft/owned', err)
    return errorResponse('upstream API error', 502, request)
  }
}
