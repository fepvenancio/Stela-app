'use client'

import { useCallback } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { toU256, MAX_BPS } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'

/** Shared call helper: builds a single-call transaction to the Stela contract */
function buildCall(entrypoint: string, calldata: string[]) {
  return { contractAddress: CONTRACT_ADDRESS, entrypoint, calldata }
}

/** Convert inscription ID to u256 calldata pair */
function idCalldata(inscriptionId: string): string[] {
  return [...toU256(BigInt(inscriptionId))]
}

/**
 * useSignInscription - validates BPS range, sends sign_inscription tx, shows toast.
 */
export function useSignInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const sign = useCallback(
    async (bps: number) => {
      ensureStarknetContext({ address, status })

      if (bps < 1 || bps > 10000) {
        throw new Error('Percentage must be between 1 and 10000 BPS')
      }

      const calldata = [...idCalldata(inscriptionId), ...toU256(BigInt(bps))]
      await sendTxWithToast(sendAsync, [buildCall('sign_inscription', calldata)], 'Inscription signed')
    },
    [address, status, inscriptionId, sendAsync],
  )

  return { sign, isPending }
}

/**
 * useRepayInscription - sends repay tx, shows toast.
 */
export function useRepayInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const repay = useCallback(async () => {
    ensureStarknetContext({ address, status })
    await sendTxWithToast(sendAsync, [buildCall('repay', idCalldata(inscriptionId))], 'Inscription repaid')
  }, [address, status, inscriptionId, sendAsync])

  return { repay, isPending }
}

/**
 * useCancelInscription - sends cancel_inscription tx, shows toast.
 */
export function useCancelInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const cancel = useCallback(async () => {
    ensureStarknetContext({ address, status })
    await sendTxWithToast(sendAsync, [buildCall('cancel_inscription', idCalldata(inscriptionId))], 'Inscription cancelled')
  }, [address, status, inscriptionId, sendAsync])

  return { cancel, isPending }
}

/**
 * useLiquidateInscription - sends liquidate tx, shows toast.
 */
export function useLiquidateInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const liquidate = useCallback(async () => {
    ensureStarknetContext({ address, status })
    await sendTxWithToast(sendAsync, [buildCall('liquidate', idCalldata(inscriptionId))], 'Inscription liquidated')
  }, [address, status, inscriptionId, sendAsync])

  return { liquidate, isPending }
}

/**
 * useRedeemShares - sends redeem tx, shows toast.
 */
export function useRedeemShares(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const redeem = useCallback(async () => {
    ensureStarknetContext({ address, status })
    await sendTxWithToast(sendAsync, [buildCall('redeem', idCalldata(inscriptionId))], 'Shares redeemed')
  }, [address, status, inscriptionId, sendAsync])

  return { redeem, isPending }
}
