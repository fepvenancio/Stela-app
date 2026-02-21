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
import { formatTokenValue } from '@/lib/format'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  shares: bigint
  multiLender: boolean
  totalDebt?: string
  debtDecimals?: number
}

export function InscriptionActions({
  inscriptionId, status, isOwner, shares,
  multiLender, totalDebt, debtDecimals = 18,
}: InscriptionActionsProps) {
  const { address } = useAccount()
  const [lendAmount, setLendAmount] = useState('')

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
    const cancelButton = isOwner && status === 'open' && (
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
    )

    // Non-multi-lender: one-click lend at 100%
    if (!multiLender) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-dust">Lend the full debt amount for this inscription.</p>
          <Button
            variant="gold"
            disabled={isPending}
            onClick={async () => {
              try {
                await sign(10000)
              } catch (err) {
                toast.error('Lend failed', { description: getErrorMessage(err) })
              }
            }}
          >
            {signPending ? 'Signing...' : 'Lend'}
          </Button>
          {cancelButton}
        </div>
      )
    }

    // Multi-lender: amount-based input with auto BPS calculation
    const totalDebtFormatted = totalDebt ? formatTokenValue(totalDebt, debtDecimals) : undefined

    return (
      <div className="space-y-4">
        <p className="text-sm text-dust">
          Enter the amount you want to lend.
          {totalDebtFormatted && <span className="text-ash"> Total debt: {totalDebtFormatted}</span>}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const amount = Number(lendAmount)
            if (!amount || amount <= 0) {
              toast.error('Invalid amount', { description: 'Enter a positive number' })
              return
            }
            const total = totalDebtFormatted ? Number(totalDebtFormatted) : 0
            if (total <= 0) {
              toast.error('Cannot determine debt total')
              return
            }
            const bps = Math.floor((amount * 10000) / total)
            if (bps < 1) {
              toast.error('Amount too small', { description: 'Must represent at least 0.01% of total debt' })
              return
            }
            if (bps > 10000) {
              toast.error('Amount too large', { description: 'Cannot exceed the total debt' })
              return
            }
            try {
              await sign(bps)
            } catch (err) {
              toast.error('Lend failed', { description: getErrorMessage(err) })
            }
          }}
          className="flex gap-3"
        >
          <div className="flex-1">
            <Input
              type="number"
              value={lendAmount}
              onChange={(e) => setLendAmount(e.target.value)}
              placeholder="Amount"
              step="any"
              min={0}
            />
          </div>
          <Button type="submit" variant="gold" disabled={isPending || !lendAmount}>
            {signPending ? 'Signing...' : 'Lend'}
          </Button>
        </form>
        {cancelButton}
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

  if ((status === 'repaid' || status === 'liquidated') && shares > 0n) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">
          {status === 'repaid' ? 'Inscription repaid. Redeem your shares for the interest.' : 'Inscription liquidated. Redeem your shares for the collateral.'}
        </p>
        <Button variant="cosmic" onClick={() => redeem(shares)} disabled={isPending}>
          {redeemPending ? 'Redeeming...' : 'Redeem Shares'}
        </Button>
      </div>
    )
  }

  return <p className="text-sm text-ash">No actions available for this inscription.</p>
}
