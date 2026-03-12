import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'

const hex = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, 'Invalid hex string')

const cancelSchema = z.object({
  seller: hex,
})

const fillSchema = z.object({
  buyer: hex,
  tx_hash: hex,
})

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { id } = await params

  try {
    const db = getD1()
    const listing = await db.getShareListing(id)
    if (!listing) return errorResponse('listing not found', 404, request)
    return jsonResponse({ data: listing }, request)
  } catch (err) {
    logError('share-listings/[id] GET', err)
    return errorResponse('service unavailable', 502, request)
  }
}

/** DELETE — cancel a listing (only the seller can cancel) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) return errorResponse('invalid cancel data', 400, request)

    const db = getD1()

    const d1Limited = await rateLimitWrite(request, db, parsed.data.seller)
    if (d1Limited) return d1Limited

    const listing = await db.getShareListing(id)
    if (!listing) return errorResponse('listing not found', 404, request)
    if (listing.status !== 'active') return errorResponse('listing is not active', 400, request)

    // Verify the seller matches
    if (listing.seller.toLowerCase() !== parsed.data.seller.toLowerCase()) {
      return errorResponse('only the seller can cancel', 403, request)
    }

    await db.updateShareListingStatus(id, 'cancelled')
    return jsonResponse({ data: { id, status: 'cancelled' } }, request)
  } catch (err) {
    logError('share-listings/[id] DELETE', err)
    return errorResponse('service unavailable', 502, request)
  }
}

/** POST — mark a listing as filled (after on-chain transfer confirmation) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { id } = await params

  try {
    const body = await request.json()
    const parsed = fillSchema.safeParse(body)
    if (!parsed.success) return errorResponse('invalid fill data', 400, request)

    const db = getD1()

    const d1Limited = await rateLimitWrite(request, db, parsed.data.buyer)
    if (d1Limited) return d1Limited

    const listing = await db.getShareListing(id)
    if (!listing) return errorResponse('listing not found', 404, request)
    if (listing.status !== 'active') return errorResponse('listing is not active', 400, request)

    await db.fillShareListing(id, parsed.data.buyer, parsed.data.tx_hash)
    return jsonResponse({ data: { id, status: 'filled' } }, request)
  } catch (err) {
    logError('share-listings/[id] POST', err)
    return errorResponse('service unavailable', 502, request)
  }
}
