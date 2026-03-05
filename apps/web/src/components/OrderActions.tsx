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
import { PRIVACY_POOL_ADDRESS, CHAIN_ID } from '@/lib/config'
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
  offers?: { id: string; lender: string; bps: number; lender_commitment?: string }[]
}

export function OrderActions({
  orderId, status, borrower, debtAssets, multiLender, offers,
}: OrderActionsProps) {
  const { address, account } = useAccount()
  const { signOrder, isPending: signPending } = useSignOrder(orderId)
  const [lendAmount, setLendAmount] = useState('')
  const [privateMode, setPrivateMode] = useState(!!PRIVACY_POOL_ADDRESS)

  const settleSteps = useMemo(() =>
    privateMode
      ? [
          { label: 'Shield deposit', description: 'Approve tokens & shield to privacy pool' },
          { label: 'Confirming shield', description: 'Waiting for block confirmation' },
          { label: 'Signing offer', description: 'Sign the anonymous lend offer' },
          { label: 'Submitting offer', description: 'Recording offer for bot settlement' },
        ]
      : [
          { label: 'Approve & Settle', description: 'Confirm the transaction in your wallet' },
          { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
          { label: 'Saving offer', description: 'Recording settlement details' },
        ],
    [privateMode],
  )
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
              {privateMode
                ? 'Shield your tokens into the privacy pool. A bot will settle the loan without revealing your identity.'
                : 'Sign and settle on-chain in one step. You approve tokens and execute the settlement.'}
            </p>
            {/* Privacy Toggle */}
            {PRIVACY_POOL_ADDRESS && (
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
            )}

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
                    await signOrder(bps, privateMode, settleProgress)
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
                  {signPending ? (privateMode ? 'Shielding...' : 'Settling...') : (privateMode ? 'Shield & Lend' : 'Sign & Settle')}
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
                      await signOrder(10000, privateMode, settleProgress)
                    } catch {
                      // Error already toasted in hook
                    }
                  }}
                >
                  {signPending ? (privateMode ? 'Shielding...' : 'Settling...') : (privateMode ? 'Shield & Lend 100%' : 'Sign & Settle 100%')}
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
