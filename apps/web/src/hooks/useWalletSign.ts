'use client'

import { useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import type { TypedData } from 'starknet'

/**
 * Hook that provides a wallet-level signTypedData function.
 *
 * Tries connector.request (wallet_signTypedData) first, falls back to
 * account.signMessage() if the connector rejects. Some wallets (Argent X)
 * may fail on nested struct types (e.g. u256) via the request API but
 * handle them fine through signMessage.
 *
 * Returns signature as string[] (felt array) matching the SNIP standard.
 */
export function useWalletSign() {
  const { connector, account } = useAccount()

  const signTypedData = useCallback(
    async (typedData: TypedData): Promise<string[]> => {
      if (!connector) throw new Error('Wallet not connected')

      // Try connector.request first (preferred path)
      try {
        const result = await connector.request({
          type: 'wallet_signTypedData',
          params: typedData,
        })
        return result as string[]
      } catch {
        // Fallback to account.signMessage for wallets that reject via request API
        if (!account) throw new Error('Wallet not connected')
        const sig = await account.signMessage(typedData)
        // signMessage returns Signature which can be string[] or { r, s }
        if (Array.isArray(sig)) return sig.map(String)
        const obj = sig as unknown as { r: string; s: string }
        return [obj.r, obj.s]
      }
    },
    [connector, account],
  )

  return { signTypedData }
}
