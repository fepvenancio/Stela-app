'use client'

import { useEffect } from 'react'
import { useReadContract } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useInscription(inscriptionId: string) {
  const result = useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'get_inscription',
    args: [inscriptionId],
    watch: true,
  })

  // Re-fetch contract data when a transaction is confirmed (stela:sync event)
  useEffect(() => {
    const onSync = () => { result.refetch() }
    window.addEventListener('stela:sync', onSync)
    return () => window.removeEventListener('stela:sync', onSync)
  }, [result.refetch])

  return result
}
