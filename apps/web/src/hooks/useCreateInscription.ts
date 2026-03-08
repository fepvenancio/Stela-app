'use client'

import { useCallback, useMemo, useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import type { Asset, InscriptionParams } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { buildApprovalsIfNeeded, isApprovedForAll } from '@/lib/allowance'
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

export interface CreateInscriptionInput {
  /** Whether this is a borrow inscription (true) or swap (false / duration=0) */
  isBorrow: boolean
  debtAssets: Asset[]
  interestAssets: Asset[]
  collateralAssets: Asset[]
  /** Duration in seconds */
  duration: bigint
  /** Deadline as unix timestamp (seconds) */
  deadline: bigint
  multiLender: boolean
}

/**
 * useCreateInscription - builds ERC20/ERC4626 approval calls for collateral
 * tokens, then sends [approve..., create_inscription] as an atomic multicall.
 * Supports optional TransactionProgress for step-by-step modal feedback.
 */
export function useCreateInscription() {
  const { address, status } = useAccount()
  const { sendAsync, isPending: isSendPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()
  const [isPending, setIsPending] = useState(false)

  const createInscription = useCallback(
    async (input: CreateInscriptionInput, progress?: TransactionProgress) => {
      ensureStarknetContext({ address, status })

      setIsPending(true)
      progress?.start()

      try {
        // Build approval calls only for tokens that need it
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const erc20Tokens = [...new Set(
          input.collateralAssets
            .filter(a => a.asset_type === 'ERC20' || a.asset_type === 'ERC4626')
            .map(a => a.asset_address)
        )]
        const erc20Approvals = await buildApprovalsIfNeeded(provider, address!, erc20Tokens)

        const nftApprovals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
        const checkedNfts = new Set<string>()
        for (const asset of input.collateralAssets) {
          if (asset.asset_type !== 'ERC721' && asset.asset_type !== 'ERC1155') continue
          const key = asset.asset_address.toLowerCase()
          if (checkedNfts.has(key)) continue
          checkedNfts.add(key)
          const alreadyApproved = await isApprovedForAll(provider, asset.asset_address, address!)
          if (!alreadyApproved) {
            nftApprovals.push({
              contractAddress: asset.asset_address,
              entrypoint: 'set_approval_for_all',
              calldata: [CONTRACT_ADDRESS, '1'],
            })
          }
        }
        const approvals = [...erc20Approvals, ...nftApprovals]

        // Build the create_inscription call
        const params: InscriptionParams = {
          is_borrow: input.isBorrow,
          debt_assets: input.debtAssets,
          interest_assets: input.interestAssets,
          collateral_assets: input.collateralAssets,
          duration: input.duration,
          deadline: input.deadline,
          multi_lender: input.multiLender,
        }

        const createCall = client.buildCreateInscription(params)

        // Execute as multicall: approvals + create_inscription
        toast.info('Confirm the transaction in your wallet...')
        const result = await sendAsync([...approvals, createCall])

        progress?.setTxHash(result.transaction_hash)
        progress?.advance() // approvals + create done

        // Wait for confirmation and check receipt
        toast.info('Waiting for transaction confirmation...')
        const receipt = await provider.waitForTransaction(result.transaction_hash)

        if ('execution_status' in receipt && receipt.execution_status === 'REVERTED') {
          const reason = ('revert_reason' in receipt ? receipt.revert_reason : undefined) as string | undefined
          throw new Error(reason || 'Transaction reverted on-chain')
        }

        progress?.advance() // confirmed

        toast.success('Inscription created on-chain!', {
          description: `Tx: ${result.transaction_hash.slice(0, 16)}...`,
        })

        sync(result.transaction_hash, {
          debt: input.debtAssets.map(a => ({ asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          interest: input.interestAssets.map(a => ({ asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          collateral: input.collateralAssets.map(a => ({ asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
        }).catch(() => {})
        progress?.advance()
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        progress?.fail(msg)
        toast.error('Failed to create inscription', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, status, sendAsync, client, sync],
  )

  return { createInscription, isPending: isPending || isSendPending }
}
