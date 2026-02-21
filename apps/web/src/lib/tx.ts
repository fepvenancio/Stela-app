import { toast } from 'sonner'

/** Extract a human-readable message from an unknown error */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Execute a StarkNet transaction and show toast feedback.
 * Centralizes the try/catch + toast pattern used across all write actions.
 */
export async function sendTxWithToast(
  sendAsync: (calls: { contractAddress: string; entrypoint: string; calldata: string[] }[]) => Promise<{ transaction_hash: string }>,
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
  successMessage: string,
): Promise<string | null> {
  try {
    const result = await sendAsync(calls)
    toast.success(successMessage, { description: result.transaction_hash })
    return result.transaction_hash
  } catch (err: unknown) {
    toast.error('Transaction failed', { description: getErrorMessage(err) })
    return null
  }
}
