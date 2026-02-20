'use client'

import { useSendTransaction } from '@starknet-react/core'
import { STELA_ADDRESS } from '@stela/core'
import { toU256 } from '@/lib/u256'

export function useRedeem(agreementId: string) {
  const { sendAsync, isPending, error } = useSendTransaction({
    calls: [
      {
        contractAddress: STELA_ADDRESS.sepolia,
        entrypoint: 'redeem',
        calldata: [...toU256(BigInt(agreementId))],
      },
    ],
  })
  return { redeem: sendAsync, isPending, error }
}
