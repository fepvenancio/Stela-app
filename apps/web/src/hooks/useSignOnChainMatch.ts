'use client'

import { useCallback, useMemo, useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { buildApprovalsIfNeeded } from '@/lib/allowance'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'
import { useSync } from './useSync'
import type { TransactionProgress } from '@/hooks/useTransactionProgress'

function useInscriptionClient() {
  return useMemo(
    () =>
      new InscriptionClient({
        stelaAddress: CONTRACT_ADDRESS,
        provider: new RpcProvider({ nodeUrl: RPC_URL }),
      }),
    [],
  )
}

/** Debt asset info needed to build ERC20 approval calls */
export interface DebtAssetInfo {
  address: string
  value: string
}

/**
 * useSignOnChainMatch - builds ERC20/ERC4626 approval calls for debt tokens
 * the lender provides, then sends [approve..., sign_inscription] as an
 * atomic multicall. This is a standalone hook for filling an existing
 * on-chain inscription as a lender.
 */
export function useSignOnChainMatch() {
  const { address, status } = useAccount()
  const { sendAsync, isPending: isSendPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()
  const [isPending, setIsPending] = useState(false)

  const signOnChainMatch = useCallback(
    async (
      inscriptionId: string | bigint,
      debtAssets: DebtAssetInfo[],
      bps: number = 10000,
      progress?: TransactionProgress,
    ) => {
      ensureStarknetContext({ address, status })

      if (bps < 1 || bps > 10000) {
        throw new Error('Percentage must be between 0.01% and 100%')
      }

      if (!debtAssets || debtAssets.length === 0) {
        throw new Error(
          'No debt asset data available — the inscription may still be indexing. Please wait a moment and refresh.',
        )
      }

      setIsPending(true)
      progress?.start()

      try {
        // Build approve calls only if allowance is insufficient
        const uniqueDebtTokens = [...new Set(debtAssets.map(a => a.address))]
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const approvals = await buildApprovalsIfNeeded(provider, address!, uniqueDebtTokens)

        // Build sign_inscription call
        const id = typeof inscriptionId === 'bigint' ? inscriptionId : BigInt(inscriptionId)
        const signCall = client.buildSignInscription(id, BigInt(bps))

        // Execute as multicall: approvals + sign_inscription
        toast.info('Confirm the transaction in your wallet...')
        const result = await sendAsync([...approvals, signCall])

        progress?.setTxHash(result.transaction_hash)
        progress?.advance() // approve + sign done

        // Wait for confirmation
        toast.info('Waiting for transaction confirmation...')
        await provider.waitForTransaction(result.transaction_hash)
        progress?.advance() // confirmed

        toast.success('Inscription signed!', {
          description: `You are now lending on inscription ${id.toString()}. Tx: ${result.transaction_hash.slice(0, 16)}...`,
        })

        sync(result.transaction_hash).catch(() => {})
        progress?.advance()
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        progress?.fail(msg)
        toast.error('Failed to sign inscription', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, status, sendAsync, client, sync],
  )

  return { signOnChainMatch, isPending: isPending || isSendPending }
}
