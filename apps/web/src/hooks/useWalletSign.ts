'use client'

import { useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import type { TypedData } from 'starknet'

/**
 * Hook that provides a wallet-level signTypedData function.
 *
 * Bypasses starknet.js WalletAccount.signMessage() which has a compatibility
 * issue with newer wallet extensions (Ready/Argent X). Instead, calls the
 * wallet's request API directly via the starknet-react connector, which
 * properly wraps the call with error handling.
 *
 * Returns signature as string[] (felt array) matching the SNIP standard.
 */
export function useWalletSign() {
  const { connector } = useAccount()

  const signTypedData = useCallback(
    async (typedData: TypedData): Promise<string[]> => {
      if (!connector) throw new Error('Wallet not connected')
      const result = await connector.request({
        type: 'wallet_signTypedData',
        params: typedData,
      })
      // Wallet returns string[] per SNIP standard
      return result as string[]
    },
    [connector],
  )

  return { signTypedData }
}
