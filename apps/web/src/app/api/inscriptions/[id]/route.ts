import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createD1Queries } from '@stela/core'
import type { D1Database } from '@stela/core'

const HEX_PATTERN = /^0x[0-9a-fA-F]{1,64}$/

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!HEX_PATTERN.test(id)) {
    return NextResponse.json({ error: 'invalid inscription id' }, { status: 400 })
  }

  try {
    const { env } = getCloudflareContext()
    const db = createD1Queries(env.DB as unknown as D1Database)
    const inscription = await db.getInscription(id)

    if (!inscription) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const assets = await db.getInscriptionAssets(id)

    return NextResponse.json({ ...inscription as Record<string, unknown>, assets })
  } catch (err) {
    console.error('D1 query error:', err)
    return NextResponse.json({ error: 'service unavailable' }, { status: 502 })
  }
}
