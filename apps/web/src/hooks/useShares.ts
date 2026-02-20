'use client'

import { useReadContract, useAccount } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useShares(inscriptionId: string) {
  const { address } = useAccount()

  return useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address, inscriptionId] : undefined,
    watch: true,
    enabled: Boolean(address),
  })
}
