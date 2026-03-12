'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { getCollectionLendOfferTypedData } from '@/lib/offchain'
import { CHAIN_ID } from '@/lib/config'
import { useWalletSign } from '@/hooks/useWalletSign'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useCollectionOffer() {
  const { address } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const createCollectionOffer = useCallback(
    async (params: {
      collectionAddress: string
      debtAssets: Array<{ asset_address: string; asset_type: string; value: string; token_id?: string }>
      interestAssets: Array<{ asset_address: string; asset_type: string; value: string; token_id?: string }>
      debtCount: number
      interestCount: number
      duration: bigint
      deadline: bigint
      nonce: bigint
    }) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getCollectionLendOfferTypedData({
          lender: address,
          collectionAddress: params.collectionAddress,
          debtAssets: params.debtAssets.map(a => ({
            asset_address: a.asset_address,
            asset_type: a.asset_type as 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626',
            value: BigInt(a.value),
            token_id: BigInt(a.token_id ?? '0'),
          })),
          interestAssets: params.interestAssets.map(a => ({
            asset_address: a.asset_address,
            asset_type: a.asset_type as 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626',
            value: BigInt(a.value),
            token_id: BigInt(a.token_id ?? '0'),
          })),
          debtCount: params.debtCount,
          interestCount: params.interestCount,
          duration: params.duration,
          deadline: params.deadline,
          nonce: params.nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)
        const offerId = crypto.randomUUID()

        const res = await fetch('/api/collection-offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: offerId,
            lender: address,
            collection_address: params.collectionAddress,
            order_data: {
              lender: address,
              collectionAddress: params.collectionAddress,
              debtAssets: params.debtAssets,
              interestAssets: params.interestAssets,
              debtCount: params.debtCount,
              interestCount: params.interestCount,
              duration: params.duration.toString(),
              deadline: params.deadline.toString(),
              nonce: params.nonce.toString(),
            },
            lender_signature: signature.map(String),
            nonce: params.nonce.toString(),
            deadline: Number(params.deadline),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Collection offer created!')
        return offerId
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to create collection offer', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  return { createCollectionOffer, isPending }
}
