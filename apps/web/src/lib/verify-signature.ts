/**
 * Server-side StarkNet signature verification via raw JSON-RPC.
 *
 * Calls the account contract's `is_valid_signature(hash, signature)` function
 * which follows the SNIP-6 standard (Account interface).
 *
 * Works in Cloudflare Worker environment — uses only fetch(), no starknet.js Account.
 */

import { RPC_URL } from '@/lib/config'

/**
 * The `is_valid_signature` entry_point_selector.
 * Computed as: getSelectorFromName('is_valid_signature')
 * This is the standard SNIP-6 Account interface selector.
 */
const IS_VALID_SIGNATURE_SELECTOR =
  '0x28420862938116cb3bbdbedee07451ccc54d4e9412dbef71142ad1980a30941'

/**
 * Verify a StarkNet SNIP-12 signature by calling the signer's account contract.
 *
 * Uses raw JSON-RPC `starknet_call` to invoke `is_valid_signature` on the
 * account contract. This avoids needing a full starknet.js Account instance
 * and works in any JS runtime (including Cloudflare Workers).
 *
 * @param accountAddress - The signer's StarkNet account address
 * @param messageHash - The SNIP-12 typed data message hash (felt252)
 * @param signature - Array of signature felt strings [r, s]
 * @returns true if the signature is valid, false otherwise
 */
export async function verifyStarknetSignature(
  accountAddress: string,
  messageHash: string,
  signature: string[],
): Promise<boolean> {
  // Build the calldata for is_valid_signature(hash: felt252, signature: Array<felt252>)
  // Cairo serialization: hash, then array length, then array elements
  const calldata = [
    messageHash,
    String(signature.length),
    ...signature,
  ]

  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'starknet_call',
    params: {
      request: {
        contract_address: accountAddress,
        entry_point_selector: IS_VALID_SIGNATURE_SELECTOR,
        calldata,
      },
      block_id: 'latest',
    },
  }

  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`RPC HTTP error during signature verification: ${response.status}`)
      return false
    }

    const result = await response.json() as {
      result?: string[]
      error?: { code: number; message: string }
    }

    if (result.error) {
      console.error('RPC error during signature verification:', result.error.message)
      return false
    }

    if (!result.result || result.result.length === 0) {
      return false
    }

    // is_valid_signature returns a single felt: 'VALID' encoded as a shortstring.
    // 'VALID' in ASCII = 0x56414c4944
    const VALID_SHORTSTRING = '0x56414c4944'
    const returned = result.result[0]

    // Normalize for comparison: strip 0x prefix and leading zeros, then lowercase
    const normalize = (v: string) => {
      const stripped = v.replace(/^0x0*/i, '').toLowerCase()
      return stripped || '0'
    }

    return normalize(returned) === normalize(VALID_SHORTSTRING)
  } catch (err) {
    console.error(
      'Signature verification RPC call failed:',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}
