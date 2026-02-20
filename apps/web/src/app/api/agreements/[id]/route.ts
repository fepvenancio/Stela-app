import { NextRequest, NextResponse } from 'next/server'
import { indexerFetch } from '@/lib/indexer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await indexerFetch(`/api/agreements/${encodeURIComponent(id)}`)
  const data = await res.json()

  return NextResponse.json(data, { status: res.status })
}
