import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, rateLimit, logError } from '@/lib/api'
import { TERMS_VERSION, TERMS_HASH } from '@/lib/terms-config'

/**
 * GET /api/terms?address=0x...
 * Check if a wallet has agreed to the current terms version.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const address = request.nextUrl.searchParams.get('address')
  if (!address) return errorResponse('address is required', 400, request)

  try {
    const db = getD1()
    const agreement = await db.getTermsAgreement(address, TERMS_VERSION)
    return jsonResponse({ agreed: !!agreement, version: TERMS_VERSION }, request)
  } catch (err) {
    logError('GET /api/terms', err)
    return errorResponse('internal error', 500, request)
  }
}

/**
 * POST /api/terms
 * Record a signed terms agreement.
 * Body: { address, signatureR, signatureS, messageHash, agreedAt, chainId }
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const body = (await request.json()) as Record<string, unknown>
    const { address, signatureR, signatureS, messageHash, agreedAt, chainId } = body as {
      address: string; signatureR: string; signatureS: string
      messageHash: string; agreedAt: string; chainId: string
    }

    if (!address || !signatureR || !signatureS || !messageHash || !agreedAt || !chainId) {
      return errorResponse('missing required fields', 400, request)
    }

    const db = getD1()

    // Check if already agreed to this version
    const existing = await db.getTermsAgreement(address, TERMS_VERSION)
    if (existing) {
      return jsonResponse({ agreed: true, version: TERMS_VERSION, existing: true }, request)
    }

    // Generate deterministic ID from address + version
    const id = `${address.toLowerCase()}-${TERMS_VERSION}`

    await db.recordTermsAgreement({
      id,
      walletAddress: address,
      signatureR,
      signatureS,
      messageHash,
      termsVersion: TERMS_VERSION,
      termsHash: TERMS_HASH,
      agreedAt: Number(agreedAt),
      chainId,
    })

    return jsonResponse({ agreed: true, version: TERMS_VERSION }, request, 201)
  } catch (err) {
    logError('POST /api/terms', err)
    return errorResponse('internal error', 500, request)
  }
}
