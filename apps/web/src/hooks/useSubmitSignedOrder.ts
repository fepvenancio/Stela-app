'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSignTypedData, useAccount, useNetwork } from '@starknet-react/core'
import {
  buildSignedOrderTypedData,
  MatchingClient,
} from '@fepvenancio/stela-sdk'
import type { SignedOrder } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, MATCHING_ENGINE_URL } from '@/lib/config'
import { ensureStarknetContext } from './ensure-context'

/**
 * useSubmitSignedOrder — signs a SNIP-12 typed data message via the
 * wallet and submits the signed order to the matching engine.
 */
export function useSubmitSignedOrder() {
  const { address, status } = useAccount()
  const { chain } = useNetwork()
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMemo(
    () => new MatchingClient({ baseUrl: MATCHING_ENGINE_URL }),
    [],
  )

  const submit = useCallback(
    async (order: SignedOrder) => {
      ensureStarknetContext({ address, status })
      setError(null)
      setIsSubmitting(false)

      try {
        const chainId = chain.id.toString()
        const typedData = buildSignedOrderTypedData(order, chainId, CONTRACT_ADDRESS)

        const rawSig = await signTypedDataAsync(typedData)

        // Normalize signature: handle both array [r, s] and object { r, s } forms
        let signature: [string, string]
        if (Array.isArray(rawSig)) {
          signature = [String(rawSig[0]), String(rawSig[1])]
        } else if (typeof rawSig === 'object' && rawSig !== null && 'r' in rawSig && 's' in rawSig) {
          const sig = rawSig as { r: bigint | string; s: bigint | string }
          signature = [sig.r.toString(16), sig.s.toString(16)]
        } else {
          throw new Error('Unexpected signature format from wallet')
        }

        setIsSubmitting(true)
        await client.submitOrder(order, signature)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      } finally {
        setIsSubmitting(false)
      }
    },
    [address, status, chain, signTypedDataAsync, client],
  )

  return { submit, isSigning, isSubmitting, isPending: isSigning || isSubmitting, error }
}
