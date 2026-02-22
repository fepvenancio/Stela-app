'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://starknet-sepolia.public.blastapi.io'

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

      // Aggregate approvals per unique token address
      const approvalMap = new Map<string, bigint>()

      for (const item of items) {
        if (item.bps < 1 || item.bps > 10000) {
          throw new Error('Percentage must be between 1 and 10000 BPS')
        }
        for (const asset of item.debtAssets) {
          const totalValue = BigInt(asset.value || '0')
          if (totalValue <= 0n) continue
          // Ceiling division: ceil(value * bps / 10000)
          const amount = (totalValue * BigInt(item.bps) + 9999n) / 10000n
          const existing = approvalMap.get(asset.address) ?? 0n
          approvalMap.set(asset.address, existing + amount)
        }
      }

      // Build one approve call per unique token
      const approvals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
      for (const [tokenAddress, totalAmount] of approvalMap) {
        approvals.push({
          contractAddress: tokenAddress,
          entrypoint: 'approve',
          calldata: [CONTRACT_ADDRESS, ...toU256(totalAmount)],
        })
      }

      // Build sign calls
      const signCalls = items.map((item) =>
        client.buildSignInscription(BigInt(item.inscriptionId), BigInt(item.bps)),
      )

      await sendTxWithToast(
        sendAsync,
        [...approvals, ...signCalls],
        `${items.length} inscription${items.length > 1 ? 's' : ''} signed`,
      )
    },
    [address, status, sendAsync, client],
  )

  return { batchSign, isPending }
}
