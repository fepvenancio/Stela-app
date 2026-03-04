'use client'

import { useEffect } from 'react'
import { useReadContract, useAccount } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { isStarknetReady } from './ensure-context'

export function useShares(inscriptionId: string) {
  const { address, status } = useAccount()

  const result = useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address, inscriptionId] : undefined,
    watch: true,
    enabled: isStarknetReady({ address, status }),
  })

  // Re-fetch contract data when a transaction is confirmed (stela:sync event)
  useEffect(() => {
    const onSync = () => { result.refetch() }
    window.addEventListener('stela:sync', onSync)
    return () => window.removeEventListener('stela:sync', onSync)
  }, [result.refetch])

  return result
}
