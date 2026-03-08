'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'
import { useSync } from './useSync'

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
 * useSignInscription - validates BPS range, builds ERC20 approvals for debt
 * tokens, and sends [approve..., sign_inscription] as an atomic multicall.
 * Supports optional TransactionProgress for step-by-step modal feedback.
 */
export function useSignInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()

  const sign = useCallback(
    async (bps: number, debtAssets?: DebtAssetInfo[], progress?: import('@/hooks/useTransactionProgress').TransactionProgress) => {
      ensureStarknetContext({ address, status })

      if (bps < 1 || bps > 10000) {
        throw new Error('Percentage must be between 0.01% and 100%')
      }

      progress?.start()

      try {
        // Build ERC20 approval calls for each debt asset.
        // Always approve U128_MAX — D1 may store null/0 values while the
        // on-chain contract has real amounts.
        const U128_MAX = (1n << 128n) - 1n
        const approvals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
        if (!debtAssets || debtAssets.length === 0) {
          throw new Error('No debt asset data available — the inscription may still be indexing. Please wait a moment and refresh.')
        }
        const approvedTokens = new Set<string>()
        for (const asset of debtAssets) {
          const key = asset.address.toLowerCase()
          if (approvedTokens.has(key)) continue
          approvedTokens.add(key)
          approvals.push({
            contractAddress: asset.address,
            entrypoint: 'approve',
            calldata: [CONTRACT_ADDRESS, ...toU256(U128_MAX)],
          })
        }

        const signCall = client.buildSignInscription(BigInt(inscriptionId), BigInt(bps))
        const result = await sendAsync([...approvals, signCall])

        progress?.setTxHash(result.transaction_hash)
        progress?.advance() // approve+sign done

        // Wait for confirmation
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        await provider.waitForTransaction(result.transaction_hash)
        progress?.advance() // confirmed

        sync(result.transaction_hash).catch(() => {})
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        progress?.fail(msg)
        throw err
      }
    },
    [address, status, inscriptionId, sendAsync, client, sync],
  )

  return { sign, isPending }
}

/**
 * useRepayInscription - builds ERC20 approvals for debt + interest tokens,
 * then sends [approve..., repay] as an atomic multicall.
 */
export function useRepayInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()

  const repay = useCallback(async (debtAssets?: DebtAssetInfo[], interestAssets?: DebtAssetInfo[]) => {
    ensureStarknetContext({ address, status })

    // Build ERC20 approval calls for debt + interest tokens the borrower must return.
    // Aggregate by token address so same-token debt+interest don't overwrite each other.
    const approvalMap = new Map<string, bigint>()
    for (const asset of [...(debtAssets ?? []), ...(interestAssets ?? [])]) {
      const amount = BigInt(asset.value || '0')
      if (amount <= 0n) continue
      approvalMap.set(asset.address, (approvalMap.get(asset.address) ?? 0n) + amount)
    }
    const approvals = [...approvalMap].map(([tokenAddress, total]) => ({
      contractAddress: tokenAddress,
      entrypoint: 'approve',
      calldata: [CONTRACT_ADDRESS, ...toU256(total)],
    }))

    const repayCall = client.buildRepay(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [...approvals, repayCall], 'Inscription repaid', (txHash) => sync(txHash))
  }, [address, status, inscriptionId, sendAsync, client, sync])

  return { repay, isPending }
}

/**
 * useCancelInscription - sends cancel_inscription tx, shows toast.
 */
export function useCancelInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()

  const cancel = useCallback(async () => {
    ensureStarknetContext({ address, status })
    const call = client.buildCancelInscription(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [call], 'Inscription cancelled', (txHash) => sync(txHash))
  }, [address, status, inscriptionId, sendAsync, client, sync])

  return { cancel, isPending }
}

/**
 * useLiquidateInscription - sends liquidate tx, shows toast.
 */
export function useLiquidateInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()

  const liquidate = useCallback(async () => {
    ensureStarknetContext({ address, status })
    const call = client.buildLiquidate(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [call], 'Inscription liquidated', (txHash) => sync(txHash))
  }, [address, status, inscriptionId, sendAsync, client, sync])

  return { liquidate, isPending }
}

/**
 * useRedeemShares - sends redeem tx, shows toast.
 */
export function useRedeemShares(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()
  const { sync } = useSync()

  const redeem = useCallback(async (shares: bigint) => {
    ensureStarknetContext({ address, status })
    const call = client.buildRedeem(BigInt(inscriptionId), shares)
    await sendTxWithToast(sendAsync, [call], 'Shares redeemed', (txHash) => sync(txHash))
  }, [address, status, inscriptionId, sendAsync, client, sync])

  return { redeem, isPending }
}
