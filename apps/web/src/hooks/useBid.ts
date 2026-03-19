'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { buildApprovalsIfNeeded } from '@/lib/allowance'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useBid() {
  const { address, account } = useAccount()
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const bid = useCallback(
    async (inscriptionId: bigint, debtTokenAddress: string) => {
      if (!address || !account) throw new Error('Wallet not connected')
      setIsPending(true)
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })

        // Build approve calls if needed
        const approveCalls = await buildApprovalsIfNeeded(provider, address, [debtTokenAddress])
        const bidCall = client.buildBid(inscriptionId)

        toast.info('Confirm the bid transaction...')
        const { transaction_hash } = await account.execute([...approveCalls, bidCall])
        toast.info('Waiting for confirmation...')
        await provider.waitForTransaction(transaction_hash)

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_hash: transaction_hash }),
        })

        toast.success('Bid successful!')
        queryClient.invalidateQueries()
        return transaction_hash
      } catch (err) {
        const msg = getErrorMessage(err)
        toast.error('Failed to bid', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account],
  )

  return { bid, isPending }
}
