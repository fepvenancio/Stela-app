'use client'

import { useReadContract, useAccount } from '@starknet-react/core'
import type { Abi } from 'starknet'
import abi from '@stela/core/abi/stela.json'
import { STELA_ADDRESS } from '@stela/core'

export function useShares(agreementId: string) {
  const { address } = useAccount()

  return useReadContract({
    abi: abi as Abi,
    address: STELA_ADDRESS.sepolia,
    functionName: 'balance_of',
    args: address ? [address, agreementId] : undefined,
    watch: true,
    enabled: Boolean(address),
  })
}
