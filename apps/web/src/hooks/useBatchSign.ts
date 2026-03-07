'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import { RpcProvider, addAddressPadding } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
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

      // Build one approve call per unique token.
      // Use u128::MAX so the approve doesn't overwrite any existing collateral
      // allowance the user may have as a borrower (ERC20 approve is a SET, not additive).
      const U128_MAX = (1n << 128n) - 1n
      const approvals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
      for (const tokenAddress of approveTokens) {
        approvals.push({
          contractAddress: tokenAddress,
          entrypoint: 'approve',
          calldata: [CONTRACT_ADDRESS, ...toU256(U128_MAX)],
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
        (txHash) => sync(txHash),
      )
    },
    [address, status, sendAsync, client, sync],
  )

  return { batchSign, isPending }
}
