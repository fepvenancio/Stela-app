'use client'

import { useState } from 'react'
import { useAccount } from '@starknet-react/core'
import type { InscriptionStatus } from '@stela/core'
import {
  useSignInscription,
  useRepayInscription,
  useCancelInscription,
  useLiquidateInscription,
  useRedeemShares,
} from '@/hooks/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  hasShares: boolean
}

export function InscriptionActions({ inscriptionId, status, isOwner, hasShares }: InscriptionActionsProps) {
  const { address } = useAccount()
  const [percentage, setPercentage] = useState('')

  const { sign, isPending: signPending } = useSignInscription(inscriptionId)
  const { repay, isPending: repayPending } = useRepayInscription(inscriptionId)
  const { cancel, isPending: cancelPending } = useCancelInscription(inscriptionId)
  const { liquidate, isPending: liquidatePending } = useLiquidateInscription(inscriptionId)
  const { redeem, isPending: redeemPending } = useRedeemShares(inscriptionId)

  const isPending = signPending || repayPending || cancelPending || liquidatePending || redeemPending

  if (!address) {
    return <p className="text-sm text-ash">Connect your wallet to interact with this inscription.</p>
  }

  if (status === 'open' || status === 'partial') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-dust">Sign as lender by committing a percentage of the debt.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const bps = Number(percentage)
            if (!Number.isInteger(bps) || bps < 1 || bps > 10000) {
              toast.error('Invalid percentage', { description: 'Must be a whole number between 1 and 10000 BPS' })
              return
            }
            try {
              await sign(bps)
            } catch (err) {
              toast.error('Sign failed', { description: getErrorMessage(err) })
            }
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
              step={1}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ash select-none">
              BPS
            </span>
          </div>
          <Button type="submit" variant="gold" disabled={isPending || !percentage}>
            {signPending ? 'Signing...' : 'Sign'}
          </Button>
        </form>
        {isOwner && status === 'open' && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="hover:text-nova hover:border-nova/30" disabled={isPending}>
                {cancelPending ? 'Cancelling...' : 'Cancel Inscription'}
              </Button>
            }
            title="Cancel Inscription"
            description="Are you sure you want to cancel this inscription? This action cannot be undone."
            confirmLabel="Cancel Inscription"
            confirmVariant="nova"
            onConfirm={cancel}
            isPending={cancelPending}
          />
        )}
      </div>
    )
  }

  if (status === 'filled' && isOwner) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription is fully signed. Repay to release your collateral.</p>
        <Button variant="aurora" onClick={repay} disabled={isPending}>
          {repayPending ? 'Repaying...' : 'Repay Inscription'}
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
              {liquidatePending ? 'Liquidating...' : 'Liquidate'}
            </Button>
          }
          title="Liquidate Inscription"
          description="Are you sure you want to liquidate this inscription? This will claim the collateral and cannot be undone."
          confirmLabel="Liquidate"
          confirmVariant="nova"
          onConfirm={liquidate}
          isPending={liquidatePending}
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
        <Button variant="cosmic" onClick={redeem} disabled={isPending}>
          {redeemPending ? 'Redeeming...' : 'Redeem Shares'}
        </Button>
      </div>
    )
  }

  return <p className="text-sm text-ash">No actions available for this inscription.</p>
}
