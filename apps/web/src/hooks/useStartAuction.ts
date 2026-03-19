'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useStartAuction() {
  const { account } = useAccount()
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const startAuction = useCallback(
    async (inscriptionId: bigint) => {
      if (!account) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
        const call = client.buildStartAuction(inscriptionId)

        toast.info('Starting auction...')
        const { transaction_hash } = await account.execute([call])
        toast.info('Waiting for confirmation...')
        await provider.waitForTransaction(transaction_hash)

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: transaction_hash }),
        })

        toast.success('Auction started!')
        queryClient.invalidateQueries()
        return transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to start auction', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [account],
  )

  return { startAuction, isPending }
}
