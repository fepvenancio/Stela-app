'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import { ShareClient } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

/**
 * Hook for transferring ERC1155 lending shares to another address.
 * Used for selling positions on the secondary market.
 *
 * Flow:
 * 1. Seller creates listing off-chain (POST /api/share-listings)
 * 2. Buyer sees listing, sends payment to seller (separate ERC20 transfer)
 * 3. Seller transfers shares via safeTransferFrom
 * 4. Seller marks listing as filled (POST /api/share-listings/:id)
 */
export function useShareTransfer() {
  const { address, account } = useAccount()
  const [isPending, setIsPending] = useState(false)

  // Read-only client for building calls (no Account needed)
  const getClient = useCallback(() => {
    const provider = new RpcProvider({ nodeUrl: RPC_URL })
    return new ShareClient({ stelaAddress: CONTRACT_ADDRESS, provider })
  }, [])

  const transferShares = useCallback(
    async (params: {
      inscriptionId: string
      to: string
      amount: bigint
    }) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
      try {
        const client = getClient()

        const call = client.buildTransferShares(
          address,
          params.to,
          BigInt(params.inscriptionId),
          params.amount,
        )

        const result = await account.execute([call])

        toast.success('Shares transferred successfully')
        window.dispatchEvent(new CustomEvent('stela:sync'))

        return result.transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error(`Transfer failed: ${msg}`)
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, getClient],
  )

  const approveForAll = useCallback(
    async (operator: string, approved: boolean) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
      try {
        const client = getClient()

        const call = client.buildSetApprovalForAll(operator, approved)
        const result = await account.execute([call])

        toast.success(approved ? 'Operator approved' : 'Approval revoked')
        window.dispatchEvent(new CustomEvent('stela:sync'))

        return result.transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error(`Approval failed: ${msg}`)
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, getClient],
  )

  return { transferShares, approveForAll, isPending }
}
