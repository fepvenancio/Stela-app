'use client'

import { useReadContract } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useInscription(inscriptionId: string) {
  return useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'get_inscription',
    args: [inscriptionId],
    watch: true,
  })
}
