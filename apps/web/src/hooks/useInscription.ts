'use client'

import { useEffect } from 'react'
import { useReadContract } from '@starknet-react/core'
import { useQueryClient } from '@tanstack/react-query'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useInscription(inscriptionId: string) {
  const queryClient = useQueryClient()

  const result = useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'get_inscription',
    args: [inscriptionId],
    watch: true,
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
