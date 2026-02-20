import { NextRequest, NextResponse } from 'next/server'
import { indexerFetch } from '@/lib/indexer'

const HEX_PATTERN = /^0x[0-9a-fA-F]{1,64}$/

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!HEX_PATTERN.test(id)) {
    return NextResponse.json({ error: 'invalid agreement id' }, { status: 400 })
  }

  try {
    const res = await indexerFetch(`/api/agreements/${encodeURIComponent(id)}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 502 })
  }
}
