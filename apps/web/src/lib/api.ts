import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createD1Queries } from '@stela/core'
import type { D1Database } from '@stela/core'
import { isRateLimited } from '@/lib/rate-limit'

/** Allowed origins for CORS */
const ALLOWED_ORIGINS = new Set([
  'https://stela-dapp.xyz',
  'https://www.stela-dapp.xyz',
])

/** Build CORS headers, reflecting the origin only if it's in the allowlist */
function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get('Origin') ?? ''
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/** Pre-flight OPTIONS handler for CORS */
export function handleOptions(request?: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

/** Create D1 queries from the Cloudflare context binding */
export function getD1() {
  const { env } = getCloudflareContext()
  // The OpenNext Cloudflare env exposes a D1Database binding that matches
  // our minimal D1Database interface, but TypeScript sees different nominal types.
  return createD1Queries(env.DB as unknown as D1Database)
}

/** Return a JSON response with CORS headers */
export function jsonResponse(data: unknown, request?: Request, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: corsHeaders(request) })
}

/** Return a JSON error response with CORS headers */
export function errorResponse(error: string, status: number, request?: Request): NextResponse {
  return NextResponse.json({ error }, { status, headers: corsHeaders(request) })
}

/** Check rate limit for a request; returns a 429 response if limited, or null if allowed */
export function rateLimit(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const result = isRateLimited(ip)
  if (!result.limited) return null

  const retryAfter = Math.ceil(result.retryAfterMs / 1000)
  return NextResponse.json(
    { error: 'too many requests' },
    {
      status: 429,
      headers: {
        ...corsHeaders(request),
        'Retry-After': String(retryAfter),
      },
    },
  )
}
