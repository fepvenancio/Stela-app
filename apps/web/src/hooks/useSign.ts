'use client'

import { useSendTransaction } from '@starknet-react/core'
import { STELA_ADDRESS } from '@stela/core'
import { toU256 } from '@/lib/u256'

export function useSign(agreementId: string, percentage: bigint) {
  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: STELA_ADDRESS.sepolia,
        entrypoint: 'sign_agreement',
        calldata: [...toU256(BigInt(agreementId)), ...toU256(percentage)],
      },
    ],
  })
  return { sign: sendAsync, isPending, error }
}
