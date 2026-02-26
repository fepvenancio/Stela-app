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
} from '@fepvenancio/stela-sdk'

export type { StoredSignature } from '@fepvenancio/stela-sdk'

// getNonce uses the SDK's InscriptionClient which calls the correct 'nonces' entrypoint
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import type { RpcProvider } from 'starknet'

export async function getNonce(
  provider: RpcProvider,
  stelaAddress: string,
  accountAddress: string,
): Promise<bigint> {
  const client = new InscriptionClient({
    stelaAddress,
    provider,
  })
  return client.getNonce(accountAddress)
}
