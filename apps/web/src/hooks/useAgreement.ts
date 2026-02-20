'use client'

import { useReadContract } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useAgreement(agreementId: string) {
  return useReadContract({
    abi: abi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'get_agreement',
    args: [agreementId],
    watch: true,
  })
}
