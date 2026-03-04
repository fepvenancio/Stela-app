import { RpcProvider } from 'starknet'
import { RPC_URL } from '@/lib/config'
import { toast } from 'sonner'

/** Extract a human-readable message from an unknown error */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Execute a StarkNet transaction, wait for on-chain confirmation, then sync.
 * Centralizes the try/catch + toast pattern used across all write actions.
 */
export async function sendTxWithToast(
  sendAsync: (calls: { contractAddress: string; entrypoint: string; calldata: string[] }[]) => Promise<{ transaction_hash: string }>,
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
  successMessage: string,
  afterConfirm?: (txHash: string) => Promise<void>,
): Promise<string | null> {
  try {
    const result = await sendAsync(calls)
    toast.success(successMessage, { description: result.transaction_hash })

    // Wait for on-chain confirmation before syncing so refetched reads see updated state
    const provider = new RpcProvider({ nodeUrl: RPC_URL })
    provider.waitForTransaction(result.transaction_hash).then(() => {
      if (afterConfirm) {
        afterConfirm(result.transaction_hash).catch(() => {})
      }
    }).catch(() => {
      // Still try to sync even if waitForTransaction fails
      if (afterConfirm) {
        afterConfirm(result.transaction_hash).catch(() => {})
      }
    })

    return result.transaction_hash
  } catch (err: unknown) {
    toast.error('Transaction failed', { description: getErrorMessage(err) })
    return null
  }
}
