/**
 * Off-chain signing utilities — thin re-export from the SDK (source of truth).
 *
 * NEVER duplicate SNIP-12 typed data construction or asset hashing here.
 * The SDK's implementations match the Cairo contract exactly.
 */

// Re-export offchain utilities from the SDK (source of truth)
export {
  getInscriptionOrderTypedData,
  getLendOfferTypedData,
  getBatchLendOfferTypedData,
  hashAssets,
  hashBatchEntries,
  serializeSignature,
  deserializeSignature,
} from '@fepvenancio/stela-sdk'

export type { StoredSignature, BatchEntry } from '@fepvenancio/stela-sdk'

import type { RpcProvider, TypedData } from 'starknet'

/**
 * Read the on-chain nonce for an address from the Stela contract.
 *
 * Uses 'latest' block — Cartridge RPC does not support 'pending'.
 * All nonce reads (frontend, server verify, API route) MUST use the same
 * block tag. The server-side processCreateOrder has a grace window to
 * account for nonces consumed in recent blocks not yet in 'latest'.
 */
export async function getNonce(
  provider: RpcProvider,
  stelaAddress: string,
  accountAddress: string,
): Promise<bigint> {
  const result = await provider.callContract(
    {
      contractAddress: stelaAddress,
      entrypoint: 'nonces',
      calldata: [accountAddress],
    },
    'latest',
  )
  return BigInt(result[0])
}

/**
 * Build SNIP-12 typed data for an order cancellation.
 *
 * The borrower signs this to prove they want to cancel their order.
 * Both client and server must produce the same typed data to agree
 * on the message hash that gets verified via is_valid_signature.
 */
export function getCancelOrderTypedData(orderId: string, chainId: string): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' },
        { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' },
        { name: 'revision', type: 'shortstring' },
      ],
      CancelOrder: [
        { name: 'order_id', type: 'string' },
      ],
    },
    primaryType: 'CancelOrder',
    domain: {
      name: 'Stela',
      version: 'v1',
      chainId,
      revision: '1',
    },
    message: {
      order_id: orderId,
    },
  }
}
