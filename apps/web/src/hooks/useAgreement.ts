'use client'

import { useReadContract } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { STELA_ADDRESS } from '@stela/core'

export function useAgreement(agreementId: string) {
  return useReadContract({
    abi: abi as Abi,
    address: STELA_ADDRESS.sepolia,
    functionName: 'get_agreement',
    args: [agreementId],
    watch: true,
  })
}
