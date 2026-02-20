'use client'

import { useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useRepay(inscriptionId: string) {
  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: CONTRACT_ADDRESS,
        entrypoint: 'repay',
        calldata: [...toU256(BigInt(inscriptionId))],
      },
    ],
  })
  return { repay: sendAsync, isPending, error }
}
