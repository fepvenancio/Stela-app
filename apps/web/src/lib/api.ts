import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createD1Queries } from '@stela/core'
import type { D1Database } from '@stela/core'
import { isRateLimited, isAddressRateLimited, MAX_BODY_SIZE } from '@/lib/rate-limit'
import type { RateLimitMethod } from '@/lib/rate-limit'
import { AppError, NotFoundError, UnauthorizedError, ValidationError, RateLimitError } from '@/lib/errors'

export { AppError, NotFoundError, UnauthorizedError, ValidationError, RateLimitError }

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

/** Return a JSON error response with CORS headers.
 *  Accepts either an AppError instance or a plain (message, status) pair. */
export function errorResponse(error: AppError, request?: Request): NextResponse
export function errorResponse(error: string, status: number, request?: Request): NextResponse
export function errorResponse(error: string | AppError, statusOrRequest?: number | Request, request?: Request): NextResponse {
  if (error instanceof AppError) {
    const req = statusOrRequest instanceof Request ? statusOrRequest : request
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.statusCode, headers: corsHeaders(req) },
    )
  }
  const status = typeof statusOrRequest === 'number' ? statusOrRequest : 500
  return NextResponse.json({ error }, { status, headers: corsHeaders(request) })
}

/**
 * Log an error safely without leaking D1 schema details.
 * In production, only the error name/code is logged; in development, the full message is included.
 */
export function logError(context: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`${context}: [${err.name}]`)
  } else {
    console.error(`${context}: [unknown error]`)
  }
}

/**
 * Check rate limit for a request; returns a 429 response if limited, or null if allowed.
 *
 * For write operations (POST/DELETE), an optional `address` parameter enables
 * per-StarkNet-address rate limiting in addition to per-IP limiting.
 */
export function rateLimit(request: NextRequest, address?: string): NextResponse | null {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const method = (request.method as RateLimitMethod) || 'GET'

  // Check request body size for write operations
  if (method === 'POST' || method === 'DELETE') {
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'request body too large' },
        {
          status: 413,
          headers: corsHeaders(request),
        },
      )
    }
  }

  // IP-based rate limit
  const result = isRateLimited(ip, method)
  if (result.limited) {
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

  // Address-based rate limit for write operations
  if (address && (method === 'POST' || method === 'DELETE')) {
    const addrResult = isAddressRateLimited(address)
    if (addrResult.limited) {
      const retryAfter = Math.ceil(addrResult.retryAfterMs / 1000)
      return NextResponse.json(
        { error: 'too many requests for this address' },
        {
          status: 429,
          headers: {
            ...corsHeaders(request),
            'Retry-After': String(retryAfter),
          },
        },
      )
    }
  }

  return null
}
