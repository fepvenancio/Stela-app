'use client'

import { useState } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import type { InscriptionStatus } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  hasShares: boolean
}

const btnBase =
  'px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed'

export function InscriptionActions({ inscriptionId, status, isOwner, hasShares }: InscriptionActionsProps) {
  const { address } = useAccount()
  const [percentage, setPercentage] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const { sendAsync, isPending } = useSendTransaction({})

  async function handleSign() {
    if (!percentage) return
    setTxError(null)
    setTxHash(null)
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'sign_inscription',
          calldata: [...toU256(BigInt(inscriptionId)), ...toU256(BigInt(percentage))],
        },
      ])
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRepay() {
    setTxError(null)
    setTxHash(null)
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'repay',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleLiquidate() {
    setTxError(null)
    setTxHash(null)
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'liquidate',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRedeem() {
    setTxError(null)
    setTxHash(null)
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'redeem',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCancel() {
    setTxError(null)
    setTxHash(null)
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'cancel_inscription',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!address) {
    return <p className="text-sm text-ash">Connect your wallet to interact with this inscription.</p>
  }

  const feedback = (
    <>
      {txHash && (
        <p className="text-xs text-aurora mt-3 font-mono break-all">
          Tx submitted: {txHash}
        </p>
      )}
      {txError && (
        <p className="text-xs text-nova mt-3 break-all">
          {txError}
        </p>
      )}
    </>
  )

  if (status === 'open' || status === 'partial') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-dust">Sign as lender by committing a percentage of the debt.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSign()
          }}
          className="flex gap-3"
        >
          <div className="flex-1 relative">
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="Percentage"
              min="1"
              max="10000"
              className="w-full bg-abyss border border-edge rounded-xl px-4 py-2.5 text-sm text-chalk placeholder:text-ash focus:border-star focus:outline-none focus:ring-1 focus:ring-star/30 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ash select-none">
              BPS
            </span>
          </div>
          <button
            type="submit"
            disabled={isPending || !percentage}
            className={`${btnBase} bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star shadow-[0_0_20px_-5px_rgba(232,168,37,0.3)]`}
          >
            {isPending ? 'Signing...' : 'Sign'}
          </button>
        </form>
        {isOwner && status === 'open' && (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className={`${btnBase} border border-edge text-dust hover:text-nova hover:border-nova/30`}
          >
            {isPending ? 'Cancelling...' : 'Cancel Inscription'}
          </button>
        )}
        {feedback}
      </div>
    )
  }

  if (status === 'filled' && isOwner) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription is fully signed. Repay to release your collateral.</p>
        <button
          onClick={handleRepay}
          disabled={isPending}
          className={`${btnBase} bg-gradient-to-b from-aurora to-aurora/80 text-void hover:shadow-[0_0_20px_-5px_rgba(45,212,191,0.35)]`}
        >
          {isPending ? 'Repaying...' : 'Repay Inscription'}
        </button>
        {feedback}
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription has expired without repayment. Liquidate to claim collateral.</p>
        <button
          onClick={handleLiquidate}
          disabled={isPending}
          className={`${btnBase} bg-gradient-to-b from-nova to-nova/80 text-white hover:shadow-[0_0_20px_-5px_rgba(240,101,101,0.35)]`}
        >
          {isPending ? 'Liquidating...' : 'Liquidate'}
        </button>
        {feedback}
      </div>
    )
  }

  if ((status === 'repaid' || status === 'liquidated') && hasShares) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">
          {status === 'repaid' ? 'Inscription repaid. Redeem your shares for the interest.' : 'Inscription liquidated. Redeem your shares for the collateral.'}
        </p>
        <button
          onClick={handleRedeem}
          disabled={isPending}
          className={`${btnBase} bg-gradient-to-b from-cosmic to-cosmic/80 text-white hover:shadow-[0_0_20px_-5px_rgba(167,139,250,0.35)]`}
        >
          {isPending ? 'Redeeming...' : 'Redeem Shares'}
        </button>
        {feedback}
      </div>
    )
  }

  return <p className="text-sm text-ash">No actions available for this inscription.</p>
}
