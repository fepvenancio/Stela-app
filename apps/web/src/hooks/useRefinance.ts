'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { getRefinanceOfferTypedData, getRefinanceApprovalTypedData } from '@/lib/offchain'
import { CHAIN_ID } from '@/lib/config'
import { useWalletSign } from '@/hooks/useWalletSign'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useRefinance() {
  const { address } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  /** Step 1: New lender creates a refinance offer */
  const createOffer = useCallback(
    async (params: {
      inscriptionId: string
      newDebtAssets: Array<{ asset_address: string; asset_type: string; value: string; token_id?: string }>
      newInterestAssets: Array<{ asset_address: string; asset_type: string; value: string; token_id?: string }>
      newDebtCount: number
      newInterestCount: number
      newDuration: string
      deadline: string
      nonce: bigint
    }) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getRefinanceOfferTypedData({
          inscriptionId: BigInt(params.inscriptionId),
          newLender: address,
          newDebtAssets: params.newDebtAssets.map(a => ({
            asset_address: a.asset_address,
            asset_type: a.asset_type as 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626',
            value: BigInt(a.value),
            token_id: BigInt(a.token_id ?? '0'),
          })),
          newInterestAssets: params.newInterestAssets.map(a => ({
            asset_address: a.asset_address,
            asset_type: a.asset_type as 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626',
            value: BigInt(a.value),
            token_id: BigInt(a.token_id ?? '0'),
          })),
          newDebtCount: params.newDebtCount,
          newInterestCount: params.newInterestCount,
          newDuration: BigInt(params.newDuration),
          deadline: BigInt(params.deadline),
          nonce: params.nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)
        const offerId = crypto.randomUUID()

        const res = await fetch('/api/refinances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: offerId,
            inscription_id: params.inscriptionId,
            new_lender: address,
            order_data: {
              newLender: address,
              inscriptionId: params.inscriptionId,
              newDebtAssets: params.newDebtAssets,
              newInterestAssets: params.newInterestAssets,
              newDebtCount: params.newDebtCount,
              newInterestCount: params.newInterestCount,
              newDuration: params.newDuration,
              nonce: params.nonce.toString(),
            },
            lender_signature: signature.map(String),
            nonce: params.nonce.toString(),
            deadline: Number(params.deadline),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Refinance offer created!')
        return offerId
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to create refinance offer', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  /** Step 2: Borrower approves a refinance offer */
  const approveOffer = useCallback(
    async (offerId: string, offerHash: string, inscriptionId: bigint, nonce: bigint) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getRefinanceApprovalTypedData({
          inscriptionId,
          offerHash,
          borrower: address,
          nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)

        const res = await fetch(`/api/refinances/${offerId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            borrower: address,
            borrower_signature: signature.map(String),
            nonce: nonce.toString(),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Refinance approved!')
        window.dispatchEvent(new Event('stela:sync'))
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to approve refinance', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  return { createOffer, approveOffer, isPending }
}
