import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'
import { RPC_URL, CONTRACT_ADDRESS } from '@/lib/config'

const NONCES_SELECTOR =
  '0x54ed3b44e062c2512c7d33eb0c6bb551261bef4f17ca9367201ef0f7aa001'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return errorResponse('Missing address parameter', 400, request)
  }

  try {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'starknet_call',
      params: {
        request: {
          contract_address: CONTRACT_ADDRESS,
          entry_point_selector: NONCES_SELECTOR,
          calldata: [address],
        },
        block_id: 'latest',
      },
    }

    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return errorResponse(`RPC error: ${response.status}`, 502, request)
    }

    const result = await response.json() as {
      result?: string[]
      error?: { code: number; message: string }
    }

    if (result.error) {
      return errorResponse(`RPC error: ${result.error.message}`, 502, request)
    }

    if (!result.result || result.result.length === 0) {
      return errorResponse('RPC returned empty result', 502, request)
    }

    const nonce = BigInt(result.result[0]).toString()

    return jsonResponse({
      address,
      nonce,
      contract: CONTRACT_ADDRESS,
      rpc: RPC_URL.replace(/\/[^/]{20,}$/, '/***'),
    }, request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorResponse(`Failed to fetch nonce: ${msg}`, 502, request)
  }
}
