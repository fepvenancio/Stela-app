'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { getCollectionBorrowAcceptanceTypedData } from '@/lib/offchain'
import { CHAIN_ID } from '@/lib/config'
import { useWalletSign } from '@/hooks/useWalletSign'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useAcceptCollectionOffer() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const acceptOffer = useCallback(
    async (offerId: string, offerHash: string, tokenId: string, nonce: bigint) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getCollectionBorrowAcceptanceTypedData({
          offerHash,
          borrower: address,
          tokenId: BigInt(tokenId),
          nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)

        const res = await fetch(`/api/collection-offers/${offerId}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            borrower: address,
            token_id: tokenId,
            borrower_signature: signature.map(String),
            nonce: nonce.toString(),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Collection offer accepted!')
        queryClient.invalidateQueries()
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to accept offer', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  return { acceptOffer, isPending }
}
