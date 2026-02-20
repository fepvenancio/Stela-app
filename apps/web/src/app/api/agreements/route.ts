import { NextRequest, NextResponse } from 'next/server'
import { indexerFetch } from '@/lib/indexer'
import { VALID_STATUSES } from '@stela/core'

const HEX_PATTERN = /^0x[0-9a-fA-F]+$/
const ALLOWED_PARAMS = new Set(['status', 'address', 'page', 'limit'])

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams
  const safe = new URLSearchParams()

  for (const [key, value] of incoming.entries()) {
    if (!ALLOWED_PARAMS.has(key)) continue

    if (key === 'status' && !(VALID_STATUSES as readonly string[]).includes(value)) continue
    if (key === 'address' && !HEX_PATTERN.test(value)) continue
    if (key === 'page' && (!Number.isFinite(Number(value)) || Number(value) < 1)) continue
    if (key === 'limit' && (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 100)) continue

    safe.set(key, value)
  }

  const path = safe.size > 0 ? `/api/agreements?${safe}` : '/api/agreements'

  try {
    const res = await indexerFetch(path)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 502 })
  }
}
