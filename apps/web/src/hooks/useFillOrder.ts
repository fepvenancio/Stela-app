'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import type { MatchedOrder } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'
import { useSync } from './useSync'

/**
 * useFillOrder — builds fill transactions using InscriptionClient.buildFillSignedOrder()
 * and submits via useSendTransaction as an atomic multicall.
 */
export function useFillOrder() {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const { sync } = useSync()

  const client = useMemo(
    () =>
      new InscriptionClient({
        stelaAddress: CONTRACT_ADDRESS,
        provider: new RpcProvider({ nodeUrl: RPC_URL }),
      }),
    [],
  )

  const fill = useCallback(
    async (matches: MatchedOrder[]) => {
      ensureStarknetContext({ address, status })

      if (matches.length === 0) {
        throw new Error('No orders to fill')
      }

      const calls = matches.map((m) =>
        client.buildFillSignedOrder(
          m.order,
          [m.order.signature_r, m.order.signature_s],
          BigInt(m.fill_bps),
        ),
      )

      await sendTxWithToast(
        sendAsync,
        calls,
        'Order filled successfully',
        (txHash) => sync(txHash),
      )
    },
    [address, status, sendAsync, client, sync],
  )

  return { fill, isPending }
}
