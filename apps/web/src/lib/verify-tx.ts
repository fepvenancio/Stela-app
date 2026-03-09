/**
 * Verify an on-chain transaction receipt via raw JSON-RPC.
 *
 * Used to confirm that a user-submitted tx_hash actually corresponds to a
 * successful settlement transaction on the Stela contract for a SPECIFIC order.
 * Prevents attackers from reusing unrelated tx hashes.
 */

import { RPC_URL, CONTRACT_ADDRESS } from '@/lib/config'
import { normalizeAddress } from '@stela/core'

/**
 * InscriptionSigned event selector (starknet_keccak('InscriptionSigned')).
 * This event is emitted by settle() and confirms a specific order was settled.
 * Event keys: [selector, id_low, id_high, borrower, lender]
 */
const INSCRIPTION_SIGNED_SELECTOR =
  '0x319f0b51fd47a51ff14b3ffb0104f54f852f987eec0abdad46ad0d8c37d1ea5'

/**
 * Verify that a transaction hash corresponds to a successful on-chain settlement
 * of a SPECIFIC order by a SPECIFIC lender on the Stela contract.
 *
 * Checks:
 * 1. Transaction exists and succeeded
 * 2. Transaction emitted InscriptionSigned from the Stela contract
 * 3. The lender address in the event matches the claimed lender
 *
 * @param txHash - The transaction hash to verify
 * @param lender - The claimed lender address (must appear in the event)
 * @returns true only if the tx settled an order involving this lender
 */
export async function verifySettleTransaction(
  txHash: string,
  lender: string,
): Promise<boolean> {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'starknet_getTransactionReceipt',
        params: { transaction_hash: txHash },
      }),
    })

    if (!response.ok) return false

    const data = await response.json() as {
      result?: {
        execution_status?: string
        finality_status?: string
        events?: Array<{ from_address: string; keys?: string[] }>
      }
      error?: unknown
    }

    if (data.error || !data.result) return false

    // Must be successfully executed
    if (data.result.execution_status !== 'SUCCEEDED') return false

    const stelaNorm = normalizeAddress(CONTRACT_ADDRESS)
    const lenderNorm = normalizeAddress(lender)

    // Find an InscriptionSigned event from the Stela contract where the lender matches.
    // InscriptionSigned keys: [selector, id_low, id_high, borrower, lender]
    const hasMatchingSettle = data.result.events?.some((e) => {
      if (normalizeAddress(e.from_address) !== stelaNorm) return false
      if (!e.keys || e.keys.length < 5) return false
      if (normalizeAddress(e.keys[0]) !== normalizeAddress(INSCRIPTION_SIGNED_SELECTOR)) return false
      // keys[4] is the lender address
      return normalizeAddress(e.keys[4]) === lenderNorm
    })

    return hasMatchingSettle ?? false
  } catch {
    // Fail closed: if we can't verify, reject
    return false
  }
}
