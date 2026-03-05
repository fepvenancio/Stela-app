'use client'

import { useState, useMemo } from 'react'
import { useAccount } from '@starknet-react/core'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'
import {
  useSignInscription,
  useRepayInscription,
  useCancelInscription,
  useLiquidateInscription,
  useRedeemShares,
} from '@/hooks/transactions'
import type { DebtAssetInfo } from '@/hooks/transactions'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PRIVACY_POOL_ADDRESS } from '@/lib/config'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { formatTokenValue } from '@/lib/format'
import { parseAmount } from '@/lib/amount'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  isBorrower: boolean
  shares: bigint
  multiLender: boolean
  debtAssets: DebtAssetInfo[]
  interestAssets?: DebtAssetInfo[]
  debtDecimals?: number
  wasSigned: boolean
}

export function InscriptionActions({
  inscriptionId, status, isOwner, isBorrower, shares,
  multiLender, debtAssets, interestAssets, debtDecimals = 18, wasSigned,
}: InscriptionActionsProps) {
  const { address } = useAccount()
  const [lendAmount, setLendAmount] = useState('')
  const [privateMode, setPrivateMode] = useState(!!PRIVACY_POOL_ADDRESS)

  const { sign, isPending: signPending } = useSignInscription(inscriptionId)
  const { repay, isPending: repayPending } = useRepayInscription(inscriptionId)
  const { cancel, isPending: cancelPending } = useCancelInscription(inscriptionId)
  const { liquidate, isPending: liquidatePending } = useLiquidateInscription(inscriptionId)
  const { redeem, isPending: redeemPending } = useRedeemShares(inscriptionId)

  const signSteps = useMemo(() =>
    privateMode
      ? [
          { label: 'Shield deposit', description: 'Approve tokens & shield to privacy pool' },
          { label: 'Confirming shield', description: 'Waiting for block confirmation' },
          { label: 'Signing inscription', description: 'Sign the lending transaction' },
          { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
        ]
      : [
          { label: 'Approve & Sign', description: 'Confirm the transaction in your wallet' },
          { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
        ],
    [privateMode],
  )
  const signProgress = useTransactionProgress(signSteps)

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

    const privacyToggle = PRIVACY_POOL_ADDRESS && (
      <div className="pb-4 mb-4 border-b border-star/10 space-y-3">
        <button
          type="button"
          onClick={() => setPrivateMode(!privateMode)}
          className="w-full flex items-center justify-between p-3 rounded-2xl border border-edge/20 bg-abyss/40 hover:border-star/30 transition-colors"
          aria-label="Toggle private lending"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${privateMode ? 'bg-star/20 text-star' : 'bg-surface/40 text-ash'} transition-colors`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div className="text-left">
              <span className="text-xs text-chalk font-display block">Private Lending</span>
              <span className="text-[10px] text-ash">Your identity is hidden on-chain</span>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${privateMode ? 'bg-star' : 'bg-edge/40'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-chalk transition-transform ${privateMode ? 'left-5' : 'left-0.5'}`} />
          </div>
        </button>
        {privateMode && (
          <p className="text-[10px] text-dust leading-relaxed px-1">
            Your tokens are shielded in the privacy pool. A bot settles the loan — your address never appears on-chain. A private note is saved to your browser for redemption.
          </p>
        )}
      </div>
    )

    // Non-multi-lender: one-click lend at 100%
    if (!multiLender) {
      return (
        <>
          <div className="space-y-6">
            {privacyToggle}
            <div className="p-4 rounded-2xl bg-star/5 border border-star/10 text-center">
               <span className="text-[10px] text-star uppercase tracking-widest font-bold">Rewards for Lender</span>
               <p className="text-xs text-dust mt-1">Full 100% of interest assets will be claimed upon completion.</p>
            </div>
            <Button
              variant="gold"
              size="xl"
              className="w-full text-lg shadow-[0_0_20px_rgba(232,168,37,0.2)]"
              disabled={isPending}
              onClick={async () => {
                try {
                  await sign(10000, debtAssets, signProgress)
                } catch (err) {
                  toast.error('Lend failed', { description: getErrorMessage(err) })
                }
              }}
            >
              {signPending
                ? (privateMode ? 'Shielding...' : 'Signing...')
                : (privateMode ? 'Shield & Lend 100%' : 'Sign & Lend 100%')
              }
            </Button>
            <div className="flex justify-center">
              {cancelButton}
            </div>
          </div>
          <TransactionProgressModal
            open={signProgress.open}
            steps={signProgress.steps}
            txHash={signProgress.txHash}
            onClose={signProgress.close}
          />
        </>
      )
    }

    // Multi-lender: amount-based input with auto BPS calculation
    const totalDebt = debtAssets[0]?.value
    const totalDebtFormatted = totalDebt ? formatTokenValue(totalDebt, debtDecimals) : undefined

    return (
      <>
        <div className="space-y-6">
          {privacyToggle}
          <div className="p-4 rounded-2xl bg-star/5 border border-star/10 text-center">
             <span className="text-[10px] text-star uppercase tracking-widest font-bold">Multi-Lending Active</span>
             <p className="text-xs text-dust mt-1">Total Vault Debt: {totalDebtFormatted}</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const totalRaw = BigInt(debtAssets[0]?.value || '0')
              if (totalRaw <= 0n) {
                toast.error('Cannot determine debt total')
                return
              }
              const lendRaw = parseAmount(lendAmount, debtDecimals)
              if (lendRaw <= 0n) {
                toast.error('Invalid amount', { description: 'Enter a positive number' })
                return
              }
              const bps = Number((lendRaw * 10000n) / totalRaw)
              if (bps < 1) {
                toast.error('Amount too small', { description: 'Must represent at least 0.01% of total debt' })
                return
              }
              if (bps > 10000) {
                toast.error('Amount too large', { description: 'Cannot exceed the total debt' })
                return
              }
              try {
                await sign(bps, debtAssets, signProgress)
              } catch (err) {
                toast.error('Lend failed', { description: getErrorMessage(err) })
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor={`lend-amount-${inscriptionId}`} className="text-[10px] text-ash uppercase tracking-widest px-2">Your Contribution</label>
              <Input
                id={`lend-amount-${inscriptionId}`}
                type="text"
                inputMode="decimal"
                value={lendAmount}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d{0,3}$/.test(v)) setLendAmount(v)
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text')
                  if (!/^\d*\.?\d{0,3}$/.test(text)) e.preventDefault()
                }}
                placeholder="0.000"
                className="h-14 text-lg bg-void/50 font-mono"
              />
            </div>
            <Button type="submit" variant="gold" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(232,168,37,0.2)]" disabled={isPending || !lendAmount}>
              {signPending
                ? (privateMode ? 'Shielding...' : 'Signing...')
                : (privateMode ? 'Shield & Lend' : 'Sign & Lend')
              }
            </Button>
          </form>
          <div className="flex justify-center">
            {cancelButton}
          </div>
        </div>
        <TransactionProgressModal
          open={signProgress.open}
          steps={signProgress.steps}
          txHash={signProgress.txHash}
          onClose={signProgress.close}
        />
      </>
    )
  }

  if (status === 'filled' && isBorrower) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-aurora/5 border border-aurora/10 text-center">
           <span className="text-[10px] text-aurora uppercase tracking-widest font-bold">Repayment Required</span>
           <p className="text-xs text-dust mt-1 text-balance">To release your collateral, you must repay the total debt with interest.</p>
        </div>
        <Button variant="aurora" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(16,185,129,0.15)]" onClick={() => repay(debtAssets, interestAssets)} disabled={isPending}>
          {repayPending ? 'Repaying...' : 'Repay Inscription'}
        </Button>
      </div>
    )
  }

  if (status === 'expired') {
    // Expired but never signed — no assets locked, nothing to liquidate
    if (!wasSigned) {
      return (
        <div className="space-y-3 text-center">
          <p className="text-xs text-ash italic uppercase tracking-widest">Vault Expired</p>
          <p className="text-xs text-dust">This inscription expired without any lender signing. No assets are locked.</p>
        </div>
      )
    }

    // Expired after being signed — assets are locked, can be liquidated
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-nova/5 border border-nova/10 text-center">
           <span className="text-[10px] text-nova uppercase tracking-widest font-bold">Default Detected</span>
           <p className="text-xs text-dust mt-1">This vault has expired without repayment. Lenders can now claim the collateral.</p>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="nova" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(239,68,68,0.2)]" disabled={isPending}>
              {liquidatePending ? 'Liquidating...' : 'Liquidate Vault'}
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
      <div className="space-y-6 text-center">
        <div className="p-4 rounded-2xl bg-cosmic/5 border border-cosmic/10">
          <span className="text-[10px] text-cosmic uppercase tracking-widest font-bold">Assets Available</span>
          <p className="text-xs text-dust mt-1">
            {status === 'repaid' ? 'Debt was repaid. Claim your portion of the principal and interest.' : 'Vault was liquidated. Claim your portion of the collateral assets.'}
          </p>
        </div>
        <Button variant="cosmic" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(139,92,246,0.15)]" onClick={() => redeem(shares)} disabled={isPending}>
          {redeemPending ? 'Redeeming...' : 'Claim Assets'}
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center py-4 bg-void/30 rounded-2xl border border-edge/20">
      <p className="text-xs text-ash uppercase tracking-widest">Vault Locked</p>
      <p className="text-[10px] text-ash/60 mt-1">Waiting for terms to change or lock period to end.</p>
    </div>
  )
}
