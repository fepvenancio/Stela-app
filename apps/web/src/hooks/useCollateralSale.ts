'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { getCollateralSaleOfferTypedData } from '@/lib/offchain'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { useWalletSign } from '@/hooks/useWalletSign'
import { buildApprovalsIfNeeded } from '@/lib/allowance'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useCollateralSale() {
  const { address, account } = useAccount()
  const queryClient = useQueryClient()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  /** Borrower creates a collateral sale offer */
  const createSaleOffer = useCallback(
    async (params: {
      inscriptionId: string
      minPrice: string
      paymentToken: string
      allowedBuyer?: string
      deadline: string
      nonce: bigint
    }) => {
      if (!address) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const typedData = getCollateralSaleOfferTypedData({
          inscriptionId: BigInt(params.inscriptionId),
          borrower: address,
          minPrice: BigInt(params.minPrice),
          paymentToken: params.paymentToken,
          allowedBuyer: params.allowedBuyer ?? '0x0',
          deadline: BigInt(params.deadline),
          nonce: params.nonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(typedData)
        const saleId = crypto.randomUUID()

        const res = await fetch('/api/collateral-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: saleId,
            inscription_id: params.inscriptionId,
            borrower: address,
            offer_data: {
              inscriptionId: params.inscriptionId,
              borrower: address,
              minPrice: params.minPrice,
              paymentToken: params.paymentToken,
              allowedBuyer: params.allowedBuyer ?? '0x0',
              deadline: params.deadline,
              nonce: params.nonce.toString(),
            },
            borrower_signature: signature.map(String),
            min_price: params.minPrice,
            deadline: Number(params.deadline),
          }),
        })

        if (!res.ok) throw new Error(await res.text())
        toast.success('Collateral sale offer created!')
        return saleId
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to create sale offer', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, signTypedData],
  )

  /** Borrower executes collateral sale on-chain */
  const executeSale = useCallback(
    async (params: {
      inscriptionId: bigint
      offer: {
        inscriptionId: bigint
        borrower: string
        minPrice: bigint
        paymentToken: string
        allowedBuyer: string
        deadline: bigint
        nonce: bigint
      }
      borrowerSig: string[]
      salePrice: bigint
      paymentTokenAddress: string
    }) => {
      if (!address || !account) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })

        const approveCalls = await buildApprovalsIfNeeded(provider, address, [params.paymentTokenAddress])
        const buyCall = client.buildBuyCollateral({
          inscriptionId: params.inscriptionId,
          offer: params.offer,
          borrowerSig: params.borrowerSig,
          salePrice: params.salePrice,
        })

        toast.info('Executing collateral sale...')
        const { transaction_hash } = await account.execute([...approveCalls, buyCall])
        toast.info('Waiting for confirmation...')
        await provider.waitForTransaction(transaction_hash)

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: transaction_hash }),
        })

        toast.success('Collateral sale complete!')
        queryClient.invalidateQueries()
        return transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to execute sale', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account],
  )

  return { createSaleOffer, executeSale, isPending }
}
