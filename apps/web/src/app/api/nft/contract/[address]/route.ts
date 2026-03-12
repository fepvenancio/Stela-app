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
}

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

  const { env } = getCloudflareContext()
  const apiKey = env.ALCHEMY_API_KEY
  if (!apiKey) {
    return errorResponse('NFT API not configured', 503, request)
  }

  const { searchParams } = request.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const startToken = searchParams.get('startToken')

  try {
    let url = `${ALCHEMY_NFT_BASE}/${apiKey}/getNFTsForContract?contractAddress=${address}&withMetadata=true&limit=${limit}`
    if (startToken) {
      url += `&startToken=${startToken}`
    }

    const res = await fetch(url)

    if (!res.ok) {
      logError('nft/contract', new Error(`Alchemy returned ${res.status}`))
      return errorResponse('upstream API error', 502, request)
    }

    const json = (await res.json()) as Record<string, unknown>
    const nfts = (json.nfts ?? []) as Array<Record<string, unknown>>

    const data: NFTItem[] = nfts.map((nft) => {
      const image = nft.image as Record<string, unknown> | undefined
      return {
        tokenId: String(nft.tokenId ?? ''),
        name: (nft.name as string) ?? null,
        image: (image?.cachedUrl as string) ?? (image?.originalUrl as string) ?? null,
      }
    })

    return jsonResponse({
      data,
      nextToken: (json.pageKey as string) ?? null,
    }, request)
  } catch (err) {
    logError('nft/contract', err)
    return errorResponse('upstream API error', 502, request)
  }
}
