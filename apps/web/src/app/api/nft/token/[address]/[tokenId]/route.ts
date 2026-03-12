import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { ALCHEMY_NFT_BASE } from '@/lib/config'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

interface NFTMetadata {
  tokenId: string
  name: string | null
  image: string | null
  description: string | null
  attributes: Array<{ trait_type: string; value: string }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string; tokenId: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { address, tokenId } = await params

  if (!/^0x[0-9a-fA-F]{1,64}$/.test(address)) {
    return errorResponse('invalid address', 400, request)
  }

  const { env } = getCloudflareContext()
  const apiKey = env.ALCHEMY_API_KEY
  if (!apiKey) {
    return errorResponse('NFT API not configured', 503, request)
  }

  try {
    const url = `${ALCHEMY_NFT_BASE}/${apiKey}/getNFTMetadata?contractAddress=${address}&tokenId=${tokenId}`
    const res = await fetch(url)

    if (!res.ok) {
      logError('nft/token', new Error(`Alchemy returned ${res.status}`))
      return errorResponse('upstream API error', 502, request)
    }

    const json = (await res.json()) as Record<string, unknown>
    const image = json.image as Record<string, unknown> | undefined
    const rawMetadata = json.raw as Record<string, unknown> | undefined
    const rawMeta = rawMetadata?.metadata as Record<string, unknown> | undefined
    const rawAttributes = (rawMeta?.attributes ?? []) as Array<Record<string, unknown>>

    const data: NFTMetadata = {
      tokenId: String(json.tokenId ?? tokenId),
      name: (json.name as string) ?? null,
      image: (image?.cachedUrl as string) ?? (image?.originalUrl as string) ?? null,
      description: (json.description as string) ?? null,
      attributes: rawAttributes.map((a) => ({
        trait_type: String(a.trait_type ?? ''),
        value: String(a.value ?? ''),
      })),
    }

    return jsonResponse({ data }, request)
  } catch (err) {
    logError('nft/token', err)
    return errorResponse('upstream API error', 502, request)
  }
}
