'use client'

import { use, useMemo, useState } from 'react'
import { useCountdown } from '@/hooks/useCountdown'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useWalletSign } from '@/hooks/useWalletSign'
import { useOrder } from '@/hooks/useOrders'
import { useSignOrder } from '@/hooks/useSignOrder'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress, addressesEqual } from '@/lib/address'
import { AddressDisplay } from '@/components/AddressDisplay'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { getCancelOrderTypedData } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import { CHAIN_ID } from '@/lib/config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/CopyButton'
import { AssetBadge } from '@/components/AssetBadge'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'

interface OrderPageProps {
  params: Promise<{ id: string }>
}

import { normalizeOrderData, type RawOrderData, type ParsedOrderData } from '@/lib/order-utils'

export default function OrderPage({ params }: OrderPageProps) {
  const { id } = use(params)
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const { data: order, isLoading, error } = useOrder(id)
  const { signOrder, isPending: signPending } = useSignOrder(id)
  const [lendAmount, setLendAmount] = useState('')
  const settleSteps = [
    { label: 'Approve & Settle', description: 'Confirm the transaction in your wallet' },
    { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
    { label: 'Saving offer', description: 'Recording settlement details' },
  ]
  const settleProgress = useTransactionProgress(settleSteps)

  const orderData = useMemo<ParsedOrderData>(() => {
    if (!order?.order_data) return normalizeOrderData({})
    const raw: RawOrderData = typeof order.order_data === 'string'
      ? (() => { try { return JSON.parse(order.order_data) } catch { return {} } })()
      : order.order_data as unknown as RawOrderData
    return normalizeOrderData(raw)
  }, [order?.order_data])

  const isOwner = useMemo(() => {
    if (!address || !order?.borrower) return false
    return addressesEqual(address, order.borrower)
  }, [address, order?.borrower])

  const { debtAssets, interestAssets, collateralAssets, duration, multiLender: isMultiLender } = orderData

  const deadlineTimestamp = useMemo(() => {
    if (!order?.deadline || Number(order.deadline) <= 0) return null
    return Number(order.deadline)
  }, [order?.deadline])
  const countdown = useCountdown(deadlineTimestamp)

  // ROI Math
  const roiInfo = useMemo(() => {
    if (debtAssets.length === 1 && interestAssets.length === 1 &&
        debtAssets[0].asset_type === 'ERC20' && interestAssets[0].asset_type === 'ERC20') {
      const debtToken = findTokenByAddress(debtAssets[0].asset_address)
      const intToken = findTokenByAddress(interestAssets[0].asset_address)

      if (debtToken && intToken && debtToken.symbol === intToken.symbol) {
        const dVal = BigInt(debtAssets[0].value || '0')
        const iVal = BigInt(interestAssets[0].value || '0')
        if (dVal > 0n) {
          const yieldBps = (iVal * 10000n) / dVal
          const yieldPct = Number(yieldBps) / 100
          return { yieldPct: yieldPct.toFixed(2), symbol: debtToken.symbol }
        }
      }
    }
    return null
  }, [debtAssets, interestAssets])

  if (error) return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Failed to load order</p><Link href="/markets" className="text-accent text-sm hover:underline">Back to Markets</Link></div>

  const isPending = order?.status === 'pending'
  const hasOffers = (order?.offers?.length ?? 0) > 0

  // Determine debt decimals for BPS calculation
  const debtDecimals = (() => {
    if (debtAssets.length === 0) return 18
    const token = findTokenByAddress(debtAssets[0].asset_address)
    return token?.decimals ?? 18
  })()

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/markets" className="text-gray-500 hover:text-accent transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Markets
        </Link>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-border/30">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Order: {id.slice(0, 8)}...</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Data */}
          <section className="bg-surface/20 border border-border/30 rounded-[32px] p-8 relative overflow-hidden">
            <div className="flex flex-wrap gap-2 justify-end mb-4">
              <Badge variant="default" className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                Off-chain
              </Badge>
              <Badge variant={isPending ? 'open' : 'cancelled'} className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                {order?.status ?? 'Loading'}
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-12">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">Total Reward for Lender</span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-white/[0.08]" /> : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-accent">
                      {roiInfo ? `+${roiInfo.yieldPct}%` : 'Variable'}
                    </span>
                    {roiInfo && <span className="text-gray-400 text-sm">in {roiInfo.symbol}</span>}
                  </div>
                )}
                <p className="text-xs text-gray-400 leading-relaxed max-w-[200px] pt-2">
                  Calculated based on the debt vs interest inscription.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">Loan Duration</span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-white/[0.08]" /> : (
                  <div className="flex flex-col">
                    <span className="text-4xl font-bold text-white">
                      {formatDuration(Number(duration))}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                      From moment of settlement
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Specifications Grid */}
          <section className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Borrower', value: order?.borrower ? <AddressDisplay address={order.borrower} className="text-sm" /> : '--', mono: true },
              { label: 'Status', value: order?.status ?? '--', mono: false },
              { label: 'Type', value: isMultiLender ? 'Multi-Lender' : 'Single-Lender', mono: false },
            ].map((field, i) => (
              <div key={i} className="bg-surface/40 border border-border/20 rounded-lg p-5">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2">{field.label}</span>
                <span className={`text-sm text-white ${field.mono ? 'font-mono' : 'font-bold'} capitalize`}>{field.value}</span>
              </div>
            ))}
          </section>

          {/* Assets view */}
          <section className="bg-surface/10 border border-border/20 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border/20 bg-surface/30">
              <h3 className="text-accent font-mono text-xs uppercase tracking-[0.3em]">Order Assets</h3>
            </div>
            <div className="p-6 space-y-8">
              {([
                { role: 'debt', assets: debtAssets },
                { role: 'interest', assets: interestAssets },
                { role: 'collateral', assets: collateralAssets },
              ] as const).map(({ role, assets }) => (
                <div key={role} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 shrink-0 w-32">
                    <div className={`w-2 h-2 rounded-full ${role === 'debt' ? 'bg-accent' : role === 'interest' ? 'bg-green-500' : 'bg-accent'}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">{role}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end flex-1">
                    {isLoading ? <Skeleton className="h-8 w-24 bg-white/[0.08]" /> : assets.length > 0 ? (
                      assets.map((ra, idx) => {
                        const token = findTokenByAddress(ra.asset_address)
                        const formattedValue = ra.asset_type === 'ERC721' ? undefined : formatTokenValue(ra.value, token?.decimals ?? 18)
                        return (
                          <AssetBadge
                            key={`${role}-${idx}`}
                            address={ra.asset_address}
                            assetType={ra.asset_type}
                            value={formattedValue}
                            tokenId={ra.token_id !== '0' ? ra.token_id : undefined}
                          />
                        )
                      })
                    ) : <span className="text-xs text-gray-400 italic">None</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Offers Section */}
          {hasOffers && (
            <section className="bg-surface/10 border border-border/20 rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/20 bg-surface/30">
                <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Lending Offers</h3>
              </div>
              <div className="p-6 space-y-3">
                {order?.offers?.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between p-4 bg-surface/40 border border-border/20 rounded-lg">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Lender</span>
                      <AddressDisplay address={offer.lender} className="text-sm" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Percentage</span>
                      <span className="text-sm text-accent font-bold">{(offer.bps / 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Actions */}
        <aside className="space-y-6">
          <Card className="border-accent/20 bg-accent/[0.02] rounded-[32px] overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-accent uppercase tracking-widest">Offer Actions</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Sign and settle on-chain in one step. You approve tokens and execute the settlement.
                </p>
              </div>

              <div className="pt-4 border-t border-accent/10">
                {isLoading ? <Skeleton className="h-24 w-full bg-white/[0.08]" /> : (
                  <Web3ActionWrapper message="Connect your wallet to make an offer">
                    {isPending && !isOwner ? (
                      isMultiLender ? (
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
                            <label htmlFor="order-lend-amount" className="text-[10px] text-gray-400 uppercase tracking-widest px-2">Your Contribution</label>
                            <Input
                              id="order-lend-amount"
                              type="number"
                              value={lendAmount}
                              onChange={(e) => setLendAmount(e.target.value)}
                              placeholder="Amount to Lend"
                              step="any"
                              min={0}
                              className="h-14 text-lg bg-[#050505]/50"
                            />
                          </div>
                          <Button type="submit" variant="default" size="xl" className="w-full text-lg" disabled={signPending || !lendAmount}>
                            {signPending ? 'Settling...' : 'Sign & Settle'}
                          </Button>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 text-center">
                            <span className="text-[10px] text-accent uppercase tracking-widest font-bold">Rewards for Lender</span>
                            <p className="text-xs text-gray-400 mt-1">Full 100% of interest assets will be claimed upon completion.</p>
                          </div>
                          <Button
                            variant="default"
                            size="xl"
                            className="w-full text-lg"
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
                      )
                    ) : isPending && isOwner ? (
                      <div className="space-y-3 text-center">
                        <p className="text-xs text-gray-400 italic uppercase tracking-widest">Your Order</p>
                        <p className="text-xs text-gray-400">Waiting for a lender to submit an offer.</p>
                        <Button
                          variant="outline"
                          className="hover:text-nova hover:border-nova/30"
                          disabled={signPending}
                          onClick={async () => {
                            if (!account || !address) return
                            try {
                              // Sign a cancellation typed data to prove ownership
                              const cancelTypedData = getCancelOrderTypedData(id, CHAIN_ID)
                              const sig = await signTypedData(cancelTypedData)
                              const sigArray = sig.map(String)

                              const res = await fetch(`/api/orders/${id}`, {
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
                    ) : (
                      <div className="text-center py-4 bg-[#050505]/30 rounded-lg border border-border/20">
                        <p className="text-xs text-gray-400 uppercase tracking-widest">Order {order?.status ?? 'Closed'}</p>
                        <p className="text-[10px] text-gray-500/60 mt-1">This order is no longer accepting offers.</p>
                      </div>
                    )}
                  </Web3ActionWrapper>
                )}
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <section className="bg-surface/20 border border-border/20 rounded-3xl p-6 space-y-4">
            <h4 className="text-accent font-mono text-xs uppercase tracking-[0.3em]">Timeline</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400 uppercase">Created</span>
                <span className="text-xs text-white font-mono">
                  {order?.created_at ? formatTimestamp(BigInt(order.created_at)) : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400 uppercase">Deadline</span>
                <span className="text-xs text-white font-mono">
                  {order?.deadline ? formatTimestamp(BigInt(order.deadline)) : '--'}
                </span>
              </div>
              {deadlineTimestamp && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 uppercase">Time Remaining</span>
                  <span
                    suppressHydrationWarning
                    className={`text-xs font-mono ${countdown.isExpired ? 'text-nova' : countdown.isUrgent ? 'text-nova' : countdown.isAtRisk ? 'text-accent' : 'text-green-500'}`}
                  >
                    {countdown.formatted}
                  </span>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <TransactionProgressModal
        open={settleProgress.open}
        steps={settleProgress.steps}
        txHash={settleProgress.txHash}
        onClose={settleProgress.close}
      />
    </div>
  )
}
