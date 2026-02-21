'use client'

import { useState } from 'react'
import { useSendTransaction, useAccount } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import type { InscriptionStatus } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from 'sonner'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  hasShares: boolean
}

export function InscriptionActions({ inscriptionId, status, isOwner, hasShares }: InscriptionActionsProps) {
  const { address } = useAccount()
  const [percentage, setPercentage] = useState('')

  const { sendAsync, isPending } = useSendTransaction({})

  async function handleSign() {
    if (!percentage) return
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'sign_inscription',
          calldata: [...toU256(BigInt(inscriptionId)), ...toU256(BigInt(percentage))],
        },
      ])
      toast.success("Transaction submitted", { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error("Transaction failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleRepay() {
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'repay',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      toast.success("Transaction submitted", { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error("Transaction failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleLiquidate() {
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'liquidate',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      toast.success("Transaction submitted", { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error("Transaction failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleRedeem() {
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'redeem',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      toast.success("Transaction submitted", { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error("Transaction failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleCancel() {
    try {
      const result = await sendAsync([
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'cancel_inscription',
          calldata: [...toU256(BigInt(inscriptionId))],
        },
      ])
      toast.success("Transaction submitted", { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error("Transaction failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  if (!address) {
    return <p className="text-sm text-ash">Connect your wallet to interact with this inscription.</p>
  }

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
            <Input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="Percentage"
              min={1}
              max={10000}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ash select-none">
              BPS
            </span>
          </div>
          <Button type="submit" variant="gold" disabled={isPending || !percentage}>
            {isPending ? 'Signing...' : 'Sign'}
          </Button>
        </form>
        {isOwner && status === 'open' && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="hover:text-nova hover:border-nova/30" disabled={isPending}>
                {isPending ? 'Cancelling...' : 'Cancel Inscription'}
              </Button>
            }
            title="Cancel Inscription"
            description="Are you sure you want to cancel this inscription? This action cannot be undone."
            confirmLabel="Cancel Inscription"
            confirmVariant="nova"
            onConfirm={handleCancel}
            isPending={isPending}
          />
        )}
      </div>
    )
  }

  if (status === 'filled' && isOwner) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription is fully signed. Repay to release your collateral.</p>
        <Button variant="aurora" onClick={handleRepay} disabled={isPending}>
          {isPending ? 'Repaying...' : 'Repay Inscription'}
        </Button>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription has expired without repayment. Liquidate to claim collateral.</p>
        <ConfirmDialog
          trigger={
            <Button variant="nova" disabled={isPending}>
              {isPending ? 'Liquidating...' : 'Liquidate'}
            </Button>
          }
          title="Liquidate Inscription"
          description="Are you sure you want to liquidate this inscription? This will claim the collateral and cannot be undone."
          confirmLabel="Liquidate"
          confirmVariant="nova"
          onConfirm={handleLiquidate}
          isPending={isPending}
        />
      </div>
    )
  }

  if ((status === 'repaid' || status === 'liquidated') && hasShares) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">
          {status === 'repaid' ? 'Inscription repaid. Redeem your shares for the interest.' : 'Inscription liquidated. Redeem your shares for the collateral.'}
        </p>
        <Button variant="cosmic" onClick={handleRedeem} disabled={isPending}>
          {isPending ? 'Redeeming...' : 'Redeem Shares'}
        </Button>
      </div>
    )
  }

  return <p className="text-sm text-ash">No actions available for this inscription.</p>
}
