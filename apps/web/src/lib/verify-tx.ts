/**
 * Verify an on-chain transaction receipt via raw JSON-RPC.
 *
 * Used to confirm that a user-submitted tx_hash actually corresponds to a
 * successful settlement transaction on the Stela contract. Prevents attackers
 * from submitting fake tx hashes to mark orders as settled.
 */

import { RPC_URL, CONTRACT_ADDRESS } from '@/lib/config'

/** Normalize a StarkNet address for comparison (strip 0x and leading zeros). */
function normalizeAddr(addr: string): string {
  return addr.replace(/^0x0*/i, '').toLowerCase() || '0'
}

/**
 * Verify that a transaction hash corresponds to a successful on-chain transaction
 * that involved the Stela contract (i.e., emitted events from it).
 *
 * @returns true if the tx exists, succeeded, and involved the Stela contract
 */
export async function verifySettleTransaction(txHash: string): Promise<boolean> {
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
        events?: Array<{ from_address: string }>
      }
      error?: unknown
    }

    if (data.error || !data.result) return false

    // Must be successfully executed
    if (data.result.execution_status !== 'SUCCEEDED') return false

    // Must involve the Stela contract (check events emitted from it)
    const stelaNorm = normalizeAddr(CONTRACT_ADDRESS)
    const involvesStela = data.result.events?.some(
      (e) => normalizeAddr(e.from_address) === stelaNorm,
    )

    return involvesStela ?? false
  } catch {
    // Fail closed: if we can't verify, reject
    return false
  }
}
