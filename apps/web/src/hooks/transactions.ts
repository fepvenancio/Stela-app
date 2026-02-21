'use client'

import { useCallback, useMemo } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { InscriptionClient } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { sendTxWithToast } from '@/lib/tx'
import { ensureStarknetContext } from './ensure-context'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://starknet-sepolia.public.blastapi.io'

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

/**
 * useSignInscription - validates BPS range, sends sign_inscription tx, shows toast.
 */
export function useSignInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()

  const sign = useCallback(
    async (bps: number) => {
      ensureStarknetContext({ address, status })

      if (bps < 1 || bps > 10000) {
        throw new Error('Percentage must be between 1 and 10000 BPS')
      }

      const call = client.buildSignInscription(BigInt(inscriptionId), BigInt(bps))
      await sendTxWithToast(sendAsync, [call], 'Inscription signed')
    },
    [address, status, inscriptionId, sendAsync, client],
  )

  return { sign, isPending }
}

/**
 * useRepayInscription - sends repay tx, shows toast.
 */
export function useRepayInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()

  const repay = useCallback(async () => {
    ensureStarknetContext({ address, status })
    const call = client.buildRepay(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [call], 'Inscription repaid')
  }, [address, status, inscriptionId, sendAsync, client])

  return { repay, isPending }
}

/**
 * useCancelInscription - sends cancel_inscription tx, shows toast.
 */
export function useCancelInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()

  const cancel = useCallback(async () => {
    ensureStarknetContext({ address, status })
    const call = client.buildCancelInscription(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [call], 'Inscription cancelled')
  }, [address, status, inscriptionId, sendAsync, client])

  return { cancel, isPending }
}

/**
 * useLiquidateInscription - sends liquidate tx, shows toast.
 */
export function useLiquidateInscription(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()

  const liquidate = useCallback(async () => {
    ensureStarknetContext({ address, status })
    const call = client.buildLiquidate(BigInt(inscriptionId))
    await sendTxWithToast(sendAsync, [call], 'Inscription liquidated')
  }, [address, status, inscriptionId, sendAsync, client])

  return { liquidate, isPending }
}

/**
 * useRedeemShares - sends redeem tx, shows toast.
 */
export function useRedeemShares(inscriptionId: string) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const client = useInscriptionClient()

  const redeem = useCallback(async (shares: bigint) => {
    ensureStarknetContext({ address, status })
    const call = client.buildRedeem(BigInt(inscriptionId), shares)
    await sendTxWithToast(sendAsync, [call], 'Shares redeemed')
  }, [address, status, inscriptionId, sendAsync, client])

  return { redeem, isPending }
}
