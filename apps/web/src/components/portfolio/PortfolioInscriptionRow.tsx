'use client'

import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import {
  useRepayInscription,
  useCancelInscription,
  useLiquidateInscription,
  useRedeemShares,
} from '@/hooks/transactions'
import type { DebtAssetInfo } from '@/hooks/transactions'
import type { EnrichedInscription } from '@/hooks/usePortfolio'

interface Props {
  ins: EnrichedInscription
}

export function PortfolioInscriptionRow({ ins }: Props) {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : ''

  // Always instantiate all hooks (React rules -- no conditional hooks)
  const { repay, isPending: repayPending } = useRepayInscription(ins.id)
  const { cancel, isPending: cancelPending } = useCancelInscription(ins.id)
  const { liquidate, isPending: liquidatePending } = useLiquidateInscription(ins.id)
  const { redeem, isPending: redeemPending } = useRedeemShares(ins.id)

  // Determine user role
  const isBorrower = ins.borrower ? normalizeAddress(ins.borrower) === normalized : false
  const isCreator = normalizeAddress(ins.creator) === normalized

  // Determine action based on status + role
  const status = ins.computedStatus
  let onAction: (() => void) | undefined
  let actionPending = false
  let actionLabel: string | undefined

  if ((status === 'filled' || status === 'grace_period') && isBorrower) {
    // Repay: borrower repays debt + interest
    const debtAssets: DebtAssetInfo[] = (ins.assets ?? [])
      .filter(a => a.asset_role === 'debt')
      .map(a => ({ address: a.asset_address, value: a.value ?? '0' }))
    const interestAssets: DebtAssetInfo[] = (ins.assets ?? [])
      .filter(a => a.asset_role === 'interest')
      .map(a => ({ address: a.asset_address, value: a.value ?? '0' }))
    onAction = () => { repay(debtAssets, interestAssets) }
    actionPending = repayPending
    actionLabel = 'Repay'
  } else if ((status === 'repaid' || status === 'liquidated') && ins.pendingShares) {
    // Claim: lender redeems shares
    onAction = () => { redeem(BigInt(ins.pendingShares!)) }
    actionPending = redeemPending
    actionLabel = 'Claim'
  } else if (status === 'open' && isCreator) {
    // Cancel: creator cancels open inscription
    onAction = () => { cancel() }
    actionPending = cancelPending
    actionLabel = 'Cancel Position'
  } else if (status === 'overdue') {
    // Liquidate: anyone can liquidate overdue inscription
    onAction = () => { liquidate() }
    actionPending = liquidatePending
    actionLabel = 'Liquidate'
  }

  return (
    <InscriptionListRow
      id={ins.id}
      status={ins.computedStatus}
      creator={ins.creator}
      multiLender={ins.multi_lender}
      duration={ins.duration}
      assets={ins.assets ?? []}
      pendingShares={ins.pendingShares}
      signedAt={ins.signed_at ?? undefined}
      onAction={onAction}
      actionPending={actionPending}
      actionLabel={actionLabel}
    />
  )
}
