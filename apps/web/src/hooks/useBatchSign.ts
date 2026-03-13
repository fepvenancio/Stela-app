'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { RpcProvider, addAddressPadding } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { buildApprovalsIfNeeded } from '@/lib/allowance'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'
import { useSync } from './useSync'

export interface BatchSignItem {
  inscriptionId: string
  bps: number
  debtAssets: { address: string; value: string }[]
}

/**
 * useBatchSign — builds aggregated ERC20 approvals + sign calls for multiple
 * inscriptions, sent as a single atomic multicall.
 */
export function useBatchSign() {
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

  const batchSign = useCallback(
    async (items: BatchSignItem[]) => {
      ensureStarknetContext({ address, status })

      if (items.length === 0) {
        throw new Error('No inscriptions selected')
      }

      // Collect unique debt token addresses that need approval.
      // Always approve even if D1 value is null/0 — the on-chain contract
      // reads the real amount from its own storage, so we must ensure allowance.
      const approveTokens = new Set<string>()

      for (const item of items) {
        if (item.bps < 1 || item.bps > 10000) {
          throw new Error('Percentage must be between 0.01% and 100%')
        }
        for (const asset of item.debtAssets) {
          const addr = addAddressPadding(asset.address)
          approveTokens.add(addr)
        }
      }

      // Build approve calls only if allowance is insufficient
      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      const uniqueTokens = [...approveTokens]
      const approvals = await buildApprovalsIfNeeded(provider, address!, uniqueTokens)

      // Build sign calls
      const signCalls = items.map((item) =>
        client.buildSignInscription(BigInt(item.inscriptionId), BigInt(item.bps)),
      )

      const txHash = await sendTxWithToast(
        sendAsync,
        [...approvals, ...signCalls],
        `${items.length} inscription${items.length > 1 ? 's' : ''} signed`,
        (txHash) => sync(txHash),
      )

      if (!txHash) {
        throw new Error('Transaction was not submitted')
      }
    },
    [address, status, sendAsync, client, sync],
  )

  return { batchSign, isPending }
}
