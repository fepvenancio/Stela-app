'use client'

import { useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'

export function useSign(agreementId: string, percentage: bigint) {
  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: CONTRACT_ADDRESS,
        entrypoint: 'sign_agreement',
        calldata: [...toU256(BigInt(agreementId)), ...toU256(percentage)],
      },
    ],
  })
  return { sign: sendAsync, isPending, error }
}
