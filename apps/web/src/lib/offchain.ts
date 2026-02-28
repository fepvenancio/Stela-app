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
  hashAssets,
  serializeSignature,
  deserializeSignature,
  // Privacy utilities
  computeCommitment,
  computeNullifier,
  hashPair,
  generateSalt,
  createPrivateNote,
} from '@fepvenancio/stela-sdk'

export type { StoredSignature, PrivateNote, PrivateRedeemRequest } from '@fepvenancio/stela-sdk'

import type { RpcProvider, TypedData } from 'starknet'

/**
 * Read the on-chain nonce for an address from the Stela contract.
 *
 * Uses provider.callContract with explicit 'latest' block identifier
 * to avoid stale reads when the provider defaults to 'pending'.
 * The provider must default to 'pending' for waitForTransaction to work,
 * but nonce reads need 'latest' to match server-side verification.
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
export function getCancelOrderTypedData(orderId: string): TypedData {
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
      chainId: 'SN_SEPOLIA',
      revision: '1',
    },
    message: {
      order_id: orderId,
    },
  }
}
