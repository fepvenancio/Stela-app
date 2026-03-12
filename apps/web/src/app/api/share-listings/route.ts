import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, rateLimitWrite, logError } from '@/lib/api'
import crypto from 'node:crypto'

const hex = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, 'Invalid hex string')

const listQuerySchema = z.object({
  inscription_id: hex.optional(),
  seller: hex.optional(),
  status: z.enum(['active', 'filled', 'cancelled', 'expired']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const createListingSchema = z.object({
  inscription_id: hex,
  seller: hex,
  shares: z.string().regex(/^\d+$/, 'shares must be numeric string'),
  payment_token: hex,
  price: z.string().regex(/^\d+$/, 'price must be numeric string'),
  deadline: z.number().int().positive(),
})

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = listQuerySchema.safeParse(params)
  if (!parsed.success) return errorResponse('invalid params', 400, request)

  try {
    const db = getD1()
    const listings = await db.getShareListings(parsed.data)
    return jsonResponse({ data: listings }, request)
  } catch (err) {
    logError('share-listings GET', err)
    return errorResponse('service unavailable', 502, request)
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const body = await request.json()
    const parsed = createListingSchema.safeParse(body)
    if (!parsed.success) return errorResponse('invalid listing data', 400, request)

    const db = getD1()

    const d1Limited = await rateLimitWrite(request, db, parsed.data.seller)
    if (d1Limited) return d1Limited

    // Verify deadline is in the future
    const now = Math.floor(Date.now() / 1000)
    if (parsed.data.deadline <= now) {
      return errorResponse('deadline must be in the future', 400, request)
    }

    // Verify shares > 0 and price > 0
    if (BigInt(parsed.data.shares) === 0n) {
      return errorResponse('shares must be > 0', 400, request)
    }
    if (BigInt(parsed.data.price) === 0n) {
      return errorResponse('price must be > 0', 400, request)
    }

    const id = crypto.randomUUID()

    await db.createShareListing({
      id,
      inscription_id: parsed.data.inscription_id,
      seller: parsed.data.seller,
      shares: parsed.data.shares,
      payment_token: parsed.data.payment_token,
      price: parsed.data.price,
      deadline: parsed.data.deadline,
    })

    return jsonResponse({ data: { id } }, request, 201)
  } catch (err) {
    logError('share-listings POST', err)
    return errorResponse('service unavailable', 502, request)
  }
}
