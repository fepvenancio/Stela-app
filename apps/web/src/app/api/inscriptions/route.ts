import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createD1Queries, VALID_STATUSES } from '@stela/core'
import type { D1Database } from '@stela/core'

const HEX_PATTERN = /^0x[0-9a-fA-F]{1,64}$/

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const status = params.get('status') ?? undefined
  const address = params.get('address') ?? undefined
  const pageRaw = params.get('page')
  const limitRaw = params.get('limit')

  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  if (address && !HEX_PATTERN.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Number(pageRaw)) : 1
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Math.min(100, Math.max(1, Number(limitRaw))) : 20

  try {
    const { env } = getCloudflareContext()
    const db = createD1Queries(env.DB as unknown as D1Database)
    const inscriptions = await db.getInscriptions({ status, address, page, limit })
    return NextResponse.json(inscriptions)
  } catch (err) {
    console.error('D1 query error:', err)
    return NextResponse.json({ error: 'service unavailable' }, { status: 502 })
  }
}
