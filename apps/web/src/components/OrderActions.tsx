'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { useSignOrder } from '@/hooks/useSignOrder'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCancelOrderTypedData } from '@/lib/offchain'
import { CHAIN_ID } from '@/lib/config'
import { parseAmount } from '@/lib/amount'
import { addressesEqual } from '@/lib/address'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import type { SerializedAsset } from '@/lib/order-utils'

interface OrderActionsProps {
  orderId: string
  status: string
  borrower: string
  debtAssets: SerializedAsset[]
  multiLender: boolean
  offers?: { id: string; lender: string; bps: number }[]
}

export function OrderActions({
  orderId, status, borrower, debtAssets, multiLender, offers,
}: OrderActionsProps) {
  const { address, account } = useAccount()
  const { signOrder, isPending: signPending } = useSignOrder(orderId)
  const [lendAmount, setLendAmount] = useState('')

  const settleSteps = useMemo(() => [
    { label: 'Approve & Settle', description: 'Confirm the transaction in your wallet' },
    { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
    { label: 'Saving offer', description: 'Recording settlement details' },
  ], [])
  const settleProgress = useTransactionProgress(settleSteps)

  const isPending = status === 'pending'
  const isOwner = address ? addressesEqual(address, borrower) : false

  const debtDecimals = (() => {
    if (debtAssets.length === 0) return 18
    const token = findTokenByAddress(debtAssets[0].asset_address)
    return token?.decimals ?? 18
  })()

  return (
    <>
      <Web3ActionWrapper message="Connect your wallet to make an offer">
        {isPending && !isOwner ? (
          <>
            <p className="text-xs text-dust leading-relaxed pb-4">
              Sign and settle on-chain in one step. You approve tokens and execute the settlement.
            </p>

            {multiLender ? (
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
                    await signOrder(bps, settleProgress)
                  } catch {
                    // Error already toasted in hook
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="order-lend-amount" className="text-[10px] text-ash uppercase tracking-widest px-2">Your Contribution</label>
                  <Input
                    id="order-lend-amount"
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
                <Button type="submit" variant="gold" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(232,168,37,0.2)]" disabled={signPending || !lendAmount}>
                  {signPending ? 'Settling...' : 'Sign & Settle'}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-star/5 border border-star/10 text-center">
                  <span className="text-[10px] text-star uppercase tracking-widest font-bold">Rewards for Lender</span>
                  <p className="text-xs text-dust mt-1">Full 100% of interest assets will be claimed upon completion.</p>
                </div>
                <Button
                  variant="gold"
                  size="xl"
                  className="w-full text-lg shadow-[0_0_20px_rgba(232,168,37,0.2)]"
                  disabled={signPending}
                  onClick={async () => {
                    try {
                      await signOrder(10000, settleProgress)
                    } catch {
                      // Error already toasted in hook
                    }
                  }}
                >
                  {signPending ? 'Settling...' : 'Sign & Settle 100%'}
                </Button>
              </div>
            )}
          </>
        ) : isPending && isOwner ? (
          <div className="space-y-3 text-center">
            <p className="text-xs text-ash italic uppercase tracking-widest">Your Order</p>
            <p className="text-xs text-dust">Waiting for a lender to submit an offer.</p>
            <Button
              variant="outline"
              className="hover:text-nova hover:border-nova/30"
              disabled={signPending}
              onClick={async () => {
                if (!account || !address) return
                try {
                  const cancelTypedData = getCancelOrderTypedData(orderId, CHAIN_ID)
                  const sig = await account.signMessage(cancelTypedData)
                  const toHex = (s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s)
                  const sigArray = Array.isArray(sig) ? sig.map(toHex) : [sig.r, sig.s].map(toHex)

                  const res = await fetch(`/api/orders/${orderId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      borrower: address,
                      signature: sigArray,
                    }),
                  })
                  if (!res.ok) {
                    const err = await res.json()
                    throw new Error((err as Record<string, string>).error || 'Failed to cancel')
                  }
                  toast.success('Order cancelled')
                } catch (err) {
                  toast.error('Failed to cancel', { description: getErrorMessage(err) })
                }
              }}
            >
              Cancel Order
            </Button>
          </div>
        ) : status === 'settled' ? (
          <div className="text-center py-4 space-y-3">
            <div className="p-4 rounded-2xl bg-aurora/5 border border-aurora/10">
              <p className="text-[10px] text-aurora uppercase tracking-widest font-bold">Settled On-Chain</p>
              <p className="text-xs text-dust mt-1">This order was settled and is now an active inscription.</p>
            </div>
            <Button asChild variant="aurora" size="xl" className="w-full text-lg">
              <Link href="/portfolio">View in Portfolio to Repay</Link>
            </Button>
          </div>
        ) : (
          <div className="text-center py-4 bg-void/30 rounded-2xl border border-edge/20">
            <p className="text-xs text-ash uppercase tracking-widest">Order {status ?? 'Closed'}</p>
            <p className="text-[10px] text-ash/60 mt-1">This order is no longer accepting offers.</p>
          </div>
        )}
      </Web3ActionWrapper>

      <TransactionProgressModal
        open={settleProgress.open}
        steps={settleProgress.steps}
        txHash={settleProgress.txHash}
        onClose={settleProgress.close}
      />
    </>
  )
}
