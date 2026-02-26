'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useOrder } from '@/hooks/useOrders'
import { useSignOrder } from '@/hooks/useSignOrder'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress, addressesEqual } from '@/lib/address'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { parseAmount } from '@/lib/amount'
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

interface OrderPageProps {
  params: Promise<{ id: string }>
}

interface SerializedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

interface RawOrderData {
  borrower?: string
  debt_assets?: SerializedAsset[]
  interest_assets?: SerializedAsset[]
  collateral_assets?: SerializedAsset[]
  debtAssets?: SerializedAsset[]
  interestAssets?: SerializedAsset[]
  collateralAssets?: SerializedAsset[]
  multi_lender?: boolean
  multiLender?: boolean
  duration?: string
  deadline?: string
}

interface ParsedOrderData {
  borrower: string
  debtAssets: SerializedAsset[]
  interestAssets: SerializedAsset[]
  collateralAssets: SerializedAsset[]
  duration: string
  deadline: string
  multiLender: boolean
}

function normalizeOrderData(raw: RawOrderData): ParsedOrderData {
  return {
    borrower: raw.borrower ?? '',
    debtAssets: raw.debt_assets ?? raw.debtAssets ?? [],
    interestAssets: raw.interest_assets ?? raw.interestAssets ?? [],
    collateralAssets: raw.collateral_assets ?? raw.collateralAssets ?? [],
    duration: raw.duration ?? '0',
    deadline: raw.deadline ?? '0',
    multiLender: raw.multi_lender ?? raw.multiLender ?? false,
  }
}

export default function OrderPage({ params }: OrderPageProps) {
  const { id } = use(params)
  const { address } = useAccount()
  const { data: order, isLoading, error } = useOrder(id)
  const { signOrder, isPending: signPending } = useSignOrder(id)
  const [lendAmount, setLendAmount] = useState('')

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

  if (error) return <div className="py-24 text-center text-nova">Failed to load order</div>

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
        <Link href="/browse" className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30">
          <span className="text-[10px] font-mono text-ash uppercase tracking-widest">Order: {id.slice(0, 8)}...</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Data */}
          <section className="bg-surface/20 border border-edge/30 rounded-[32px] p-8 relative overflow-hidden granite-noise">
            <div className="absolute top-0 right-0 p-8 flex gap-2">
              <Badge variant="default" className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                Off-chain
              </Badge>
              <Badge variant={isPending ? 'open' : 'cancelled'} className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                {order?.status ?? 'Loading'}
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-12">
              <div className="space-y-1">
                <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Total Reward for Lender</span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display text-star">
                      {roiInfo ? `+${roiInfo.yieldPct}%` : 'Variable'}
                    </span>
                    {roiInfo && <span className="text-dust text-sm">in {roiInfo.symbol}</span>}
                  </div>
                )}
                <p className="text-xs text-ash leading-relaxed max-w-[200px] pt-2">
                  Calculated based on the debt vs interest inscription.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Loan Duration</span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                  <div className="flex flex-col">
                    <span className="text-4xl font-display text-chalk">
                      {formatDuration(Number(duration))}
                    </span>
                    <span className="text-[10px] text-ash uppercase tracking-widest mt-1">
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
              { label: 'Borrower', value: order?.borrower ? formatAddress(order.borrower) : '--', mono: true },
              { label: 'Status', value: order?.status ?? '--', mono: false },
              { label: 'Type', value: isMultiLender ? 'Multi-Lender' : 'Single-Lender', mono: false },
            ].map((field, i) => (
              <div key={i} className="bg-abyss/40 border border-edge/20 rounded-2xl p-5">
                <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">{field.label}</span>
                <span className={`text-sm text-chalk ${field.mono ? 'font-mono' : 'font-display'} capitalize`}>{field.value}</span>
              </div>
            ))}
          </section>

          {/* Assets view */}
          <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
              <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Order Assets</h3>
            </div>
            <div className="p-6 space-y-8">
              {([
                { role: 'debt', assets: debtAssets },
                { role: 'interest', assets: interestAssets },
                { role: 'collateral', assets: collateralAssets },
              ] as const).map(({ role, assets }) => (
                <div key={role} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 shrink-0 w-32">
                    <div className={`w-2 h-2 rounded-full ${role === 'debt' ? 'bg-star' : role === 'interest' ? 'bg-aurora' : 'bg-nebula'}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-ash font-bold">{role}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end flex-1">
                    {isLoading ? <Skeleton className="h-8 w-24 bg-edge/20" /> : assets.length > 0 ? (
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
                    ) : <span className="text-xs text-ash italic">None</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Offers Section */}
          {hasOffers && (
            <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
                <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Lending Offers</h3>
              </div>
              <div className="p-6 space-y-3">
                {order?.offers?.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
                    <div>
                      <span className="text-[10px] text-ash uppercase tracking-widest block">Lender</span>
                      <span className="text-sm text-chalk font-mono">{formatAddress(offer.lender)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-ash uppercase tracking-widest block">Percentage</span>
                      <span className="text-sm text-star font-display">{(offer.bps / 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Actions */}
        <aside className="space-y-6">
          <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="font-display text-lg text-star uppercase tracking-widest">Offer Actions</h3>
                <p className="text-xs text-dust leading-relaxed">
                  Sign an off-chain lending offer. The settlement bot will execute it on-chain.
                </p>
              </div>

              <div className="pt-4 border-t border-star/10">
                {isLoading ? <Skeleton className="h-24 w-full bg-edge/20" /> : (
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
                              await signOrder(bps)
                            } catch (err) {
                              // Error already toasted in hook
                            }
                          }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-[10px] text-ash uppercase tracking-widest px-2">Your Contribution</label>
                            <Input
                              type="number"
                              value={lendAmount}
                              onChange={(e) => setLendAmount(e.target.value)}
                              placeholder="Amount to Lend"
                              step="any"
                              min={0}
                              className="h-14 text-lg bg-void/50"
                            />
                          </div>
                          <Button type="submit" variant="gold" size="xl" className="w-full text-lg shadow-[0_0_20px_rgba(232,168,37,0.2)]" disabled={signPending || !lendAmount}>
                            {signPending ? 'Signing...' : 'Sign & Lend'}
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
                                await signOrder(10000)
                              } catch {
                                // Error already toasted in hook
                              }
                            }}
                          >
                            {signPending ? 'Signing...' : 'Sign & Lend 100%'}
                          </Button>
                        </div>
                      )
                    ) : isPending && isOwner ? (
                      <div className="space-y-3 text-center">
                        <p className="text-xs text-ash italic uppercase tracking-widest">Your Order</p>
                        <p className="text-xs text-dust">Waiting for a lender to submit an offer.</p>
                        <Button
                          variant="outline"
                          className="hover:text-nova hover:border-nova/30"
                          disabled={signPending}
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/orders/${id}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ borrower: address }),
                              })
                              if (!res.ok) throw new Error('Failed to cancel')
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
                      <div className="text-center py-4 bg-void/30 rounded-2xl border border-edge/20">
                        <p className="text-xs text-ash uppercase tracking-widest">Order {order?.status ?? 'Closed'}</p>
                        <p className="text-[10px] text-ash/60 mt-1">This order is no longer accepting offers.</p>
                      </div>
                    )}
                  </Web3ActionWrapper>
                )}
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <section className="bg-surface/20 border border-edge/20 rounded-3xl p-6 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-ash font-bold">Timeline</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-dust uppercase">Created</span>
                <span className="text-xs text-chalk font-mono">
                  {order?.created_at ? formatTimestamp(BigInt(order.created_at)) : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-dust uppercase">Deadline</span>
                <span className="text-xs text-chalk font-mono">
                  {order?.deadline ? formatTimestamp(BigInt(order.deadline)) : '--'}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
