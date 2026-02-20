'use client'

import { useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useRepay(agreementId: string) {
  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: CONTRACT_ADDRESS,
        entrypoint: 'repay',
        calldata: [...toU256(BigInt(agreementId))],
      },
    ],
  })
  return { repay: sendAsync, isPending, error }
}
