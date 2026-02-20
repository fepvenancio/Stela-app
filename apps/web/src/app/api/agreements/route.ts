import { NextRequest, NextResponse } from 'next/server'
import { indexerFetch } from '@/lib/indexer'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString()
  const path = searchParams ? `/api/agreements?${searchParams}` : '/api/agreements'

  const res = await indexerFetch(path)
  const data = await res.json()

  return NextResponse.json(data, { status: res.status })
}
