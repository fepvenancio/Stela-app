'use client'

import { useEffect } from 'react'
import { useReadContract, useAccount } from '@starknet-react/core'
import { useQueryClient } from '@tanstack/react-query'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { isStarknetReady } from './ensure-context'

export function useShares(inscriptionId: string) {
  const { address, status } = useAccount()
  const queryClient = useQueryClient()

  const result = useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address, inscriptionId] : undefined,
    watch: true,
    enabled: isStarknetReady({ address, status }),
  })

  // Re-fetch contract data when TanStack Query cache is invalidated
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'invalidate') {
        result.refetch()
      }
    })
    return () => unsubscribe()
  }, [queryClient, result.refetch])

  return result
}
