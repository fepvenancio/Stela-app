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
import { useStartAuction } from '@/hooks/useStartAuction'
import { useBid } from '@/hooks/useBid'
import type { DebtAssetInfo } from '@/hooks/transactions'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { formatTokenValue } from '@/lib/format'
import { parseAmount } from '@/lib/amount'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  /** Enriched status that distinguishes grace_period, overdue, auctioned */
  enrichedStatus?: string
  isOwner: boolean
  isBorrower: boolean
  shares: bigint
  multiLender: boolean
  debtAssets: DebtAssetInfo[]
  interestAssets?: DebtAssetInfo[]
  debtDecimals?: number
  wasSigned: boolean
  /** Whether an auction has been started on this inscription */
  auctionStarted?: boolean
}

export function InscriptionActions({
  inscriptionId, status, enrichedStatus, isOwner, isBorrower, shares,
  multiLender, debtAssets, interestAssets, debtDecimals = 18, wasSigned,
  auctionStarted,
}: InscriptionActionsProps) {
  const { address } = useAccount()
  const [lendAmount, setLendAmount] = useState('')

  const { sign, isPending: signPending } = useSignInscription(inscriptionId)
  const { repay, isPending: repayPending } = useRepayInscription(inscriptionId)
  const { cancel, isPending: cancelPending } = useCancelInscription(inscriptionId)
  const { liquidate, isPending: liquidatePending } = useLiquidateInscription(inscriptionId)
  const { redeem, isPending: redeemPending } = useRedeemShares(inscriptionId)
  const { startAuction, isPending: auctionPending } = useStartAuction()
  const { bid, isPending: bidPending } = useBid()

  const signSteps = useMemo(() => [
    { label: 'Approve & Sign', description: 'Confirm the transaction in your wallet' },
    { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
  ], [])
  const signProgress = useTransactionProgress(signSteps)

  const isPending = signPending || repayPending || cancelPending || liquidatePending || redeemPending || auctionPending || bidPending

  // Use enrichedStatus for T1 states, fall back to base status
  const effectiveStatus = enrichedStatus ?? status

  // Resolve the primary debt token address for auction bidding
  const debtTokenAddress = debtAssets[0]?.address ?? ''

  if (!address) {
    return <p className="text-sm text-gray-400">Connect your wallet to interact with this inscription.</p>
  }

  if (status === 'open' || status === 'partial') {
    const cancelButton = isOwner && status === 'open' && (
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="hover:text-red-500 hover:border-red-500/30" disabled={isPending}>
            {cancelPending ? 'Cancelling...' : 'Cancel Inscription'}
          </Button>
        }
        title="Cancel Inscription"
        description="Are you sure you want to cancel this inscription? This action cannot be undone."
        confirmLabel="Cancel Inscription"
        confirmVariant="destructive"
        onConfirm={cancel}
        isPending={cancelPending}
      />
    )

    // Non-multi-lender: one-click lend at 100%
    if (!multiLender) {
      return (
        <>
          <div className="space-y-6">
            <div className="p-4 rounded-md bg-accent/5 border border-accent/10 text-center">
               <span className="text-[10px] text-accent uppercase tracking-widest font-bold">Rewards for Lender</span>
               <p className="text-xs text-gray-400 mt-1">Full 100% of interest assets will be claimed upon completion.</p>
            </div>
            <Button
              variant="default"
              size="xl"
              className="w-full text-lg"
              disabled={isPending}
              onClick={async () => {
                try {
                  await sign(10000, debtAssets, signProgress)
                } catch (err) {
                  toast.error('Lend failed', { description: getErrorMessage(err) })
                }
              }}
            >
              {signPending ? 'Signing...' : 'Sign & Lend 100%'}
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
          <div className="p-4 rounded-md bg-accent/5 border border-accent/10 text-center">
             <span className="text-[10px] text-accent uppercase tracking-widest font-bold">Multi-Lending Active</span>
             <p className="text-xs text-gray-400 mt-1">Total Vault Debt: {totalDebtFormatted}</p>
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
              <label htmlFor={`lend-amount-${inscriptionId}`} className="text-[10px] text-gray-400 uppercase tracking-widest px-2">Your Contribution</label>
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
                className="h-14 text-lg bg-[#050505]/50 font-mono"
              />
            </div>
            <Button type="submit" variant="default" size="xl" className="w-full text-lg" disabled={isPending || !lendAmount}>
              {signPending ? 'Signing...' : 'Sign & Lend'}
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
        <div className="p-4 rounded-md bg-green-500/5 border border-green-500/10 text-center">
           <span className="text-[10px] text-green-500 uppercase tracking-widest font-bold">Repayment Required</span>
           <p className="text-xs text-gray-400 mt-1 text-balance">To release your collateral, you must repay the total debt with interest.</p>
        </div>
        <Button variant="accent" size="xl" className="w-full text-lg" onClick={() => repay(debtAssets, interestAssets)} disabled={isPending}>
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
          <p className="text-xs text-gray-400 italic uppercase tracking-widest">Vault Expired</p>
          <p className="text-xs text-gray-400">This inscription expired without any lender signing. No assets are locked.</p>
        </div>
      )
    }

    // Expired after being signed — assets are locked, can be liquidated
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-md bg-red-500/5 border border-red-500/10 text-center">
           <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Default Detected</span>
           <p className="text-xs text-gray-400 mt-1">This vault has expired without repayment. Lenders can now claim the collateral.</p>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="xl" className="w-full text-lg" disabled={isPending}>
              {liquidatePending ? 'Liquidating...' : 'Liquidate Vault'}
            </Button>
          }
          title="Liquidate Inscription"
          description="Are you sure you want to liquidate this inscription? This will claim the collateral and cannot be undone."
          confirmLabel="Liquidate"
          confirmVariant="destructive"
          onConfirm={liquidate}
          isPending={liquidatePending}
        />
      </div>
    )
  }

  if ((status === 'repaid' || status === 'liquidated') && shares > 0n) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-4 rounded-md bg-sky-500/5 border border-cosmic/10">
          <span className="text-[10px] text-sky-500 uppercase tracking-widest font-bold">Assets Available</span>
          <p className="text-xs text-gray-400 mt-1">
            {status === 'repaid' ? 'Debt was repaid. Claim your portion of the principal and interest.' : 'Vault was liquidated. Claim your portion of the collateral assets.'}
          </p>
        </div>
        <Button variant="secondary" size="xl" className="w-full text-lg" onClick={() => redeem(shares)} disabled={isPending}>
          {redeemPending ? 'Redeeming...' : 'Claim Assets'}
        </Button>
      </div>
    )
  }

  // ── T1: Grace Period ──────────────────────────────────────────────
  if (effectiveStatus === 'grace_period') {
    if (isBorrower) {
      // Borrower can still repay during grace period — same repay flow
      return (
        <div className="space-y-6">
          <div className="p-4 rounded-md bg-accent/5 border border-accent/10 text-center">
            <span className="text-[10px] text-accent uppercase tracking-widest font-bold">Grace Period Active</span>
            <p className="text-xs text-gray-400 mt-1 text-balance">Your loan has expired, but you can still repay during the grace period to reclaim your collateral.</p>
          </div>
          <Button variant="accent" size="xl" className="w-full text-lg" onClick={() => repay(debtAssets, interestAssets)} disabled={isPending}>
            {repayPending ? 'Repaying...' : 'Repay Now'}
          </Button>
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
        <p className="text-sm text-accent">Grace period active -- the borrower can still repay.</p>
      </div>
    )
  }

  // ── T1: Overdue (past grace period, auction not started) ──────────
  if (effectiveStatus === 'overdue' && !auctionStarted) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-md bg-red-500/5 border border-red-500/10 text-center">
          <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Grace Period Expired</span>
          <p className="text-xs text-gray-400 mt-1">Anyone can start a Dutch auction on this collateral.</p>
        </div>
        <Button
          variant="destructive"
          size="xl"
          className="w-full text-lg"
          onClick={() => startAuction(BigInt(inscriptionId))}
          disabled={isPending}
        >
          {auctionPending ? 'Starting...' : 'Start Auction'}
        </Button>
      </div>
    )
  }

  // ── T1: Auction Active ────────────────────────────────────────────
  if (effectiveStatus === 'auctioned') {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-md bg-sky-400/5 border border-sky-400/10 text-center">
          <span className="text-[10px] text-sky-400 uppercase tracking-widest font-bold">Auction Active</span>
          <p className="text-xs text-gray-400 mt-1">A Dutch auction is in progress. The price declines over time.</p>
        </div>
        <Button
          variant="accent"
          size="xl"
          className="w-full text-lg"
          onClick={() => bid(BigInt(inscriptionId), debtTokenAddress)}
          disabled={isPending}
        >
          {bidPending ? 'Bidding...' : 'Bid at Auction Price'}
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center py-4 bg-[#050505]/30 rounded-md border border-border/20">
      <p className="text-xs text-gray-400 uppercase tracking-widest">Vault Locked</p>
      <p className="text-[10px] text-gray-500/60 mt-1">Waiting for terms to change or lock period to end.</p>
    </div>
  )
}
