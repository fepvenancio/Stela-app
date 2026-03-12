'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { formatAddress } from '@/lib/address'
import { getOrderStatusBadgeVariant, getOrderStatusLabel } from '@/lib/status'
import { Badge } from '@/components/ui/badge'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { OrderRow } from '@/hooks/useOrders'
import type { CollectionOfferRow, RefinanceRow, RenegotiationRow } from '@/types/api'
import Link from 'next/link'
import { toast } from 'sonner'

function EmptyTab({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <path d="M7 10h6M10 7v6" />
        </svg>
      </div>
      <p className="text-dust text-sm text-center max-w-xs">{message}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star"><path d="M6 2v8M2 6h8" /></svg>
          {cta.label}
        </Link>
      )}
    </div>
  )
}

function InscriptionList({ items }: { items: EnrichedInscription[] }) {
  return (
    <div className="flex flex-col">
      {items.map((ins) => (
        <InscriptionListRow
          key={ins.id}
          id={ins.id}
          status={ins.computedStatus}
          creator={ins.creator}
          multiLender={ins.multi_lender}
          duration={ins.duration}
          assets={ins.assets ?? []}
          pendingShares={ins.pendingShares}
          signedAt={ins.signed_at ?? undefined}
        />
      ))}
    </div>
  )
}

function matchesSearch(q: string, ins: EnrichedInscription): boolean {
  if (ins.id.toLowerCase().includes(q)) return true
  if (ins.creator.toLowerCase().includes(q)) return true
  return (ins.assets ?? []).some((a) => {
    const token = findTokenByAddress(a.asset_address)
    return (
      token?.symbol.toLowerCase().includes(q) ||
      token?.name.toLowerCase().includes(q) ||
      a.asset_address.toLowerCase().includes(q)
    )
  })
}

function matchesT1Search(q: string, item: { id: string; status: string; deadline: string }): boolean {
  if (item.id.toLowerCase().includes(q)) return true
  if (item.status.toLowerCase().includes(q)) return true
  return false
}

function matchesOrderSearch(q: string, order: OrderRow): boolean {
  if (order.id.toLowerCase().includes(q)) return true
  if (order.borrower.toLowerCase().includes(q)) return true
  const raw: RawOrderData = typeof order.order_data === 'string'
    ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
    : (order.order_data as unknown as RawOrderData) ?? {}
  const data = normalizeOrderData(raw)
  return [...data.debtAssets, ...data.interestAssets, ...data.collateralAssets].some((a) => {
    const token = findTokenByAddress(a.asset_address)
    return (
      token?.symbol.toLowerCase().includes(q) ||
      token?.name.toLowerCase().includes(q) ||
      a.asset_address.toLowerCase().includes(q)
    )
  })
}

/** Sub-section heading within a tab */
function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface/20 border-b border-edge/20">
      <span className="text-[11px] font-mono uppercase tracking-wider text-dust">{label}</span>
      <div className="flex-1 h-px bg-edge/15" />
    </div>
  )
}

/** Compact row for T1 entities (collection offers, refinances, renegotiations) */
function T1Row({ label, id, counterparty, status, deadline, createdAt }: {
  label: string
  id: string
  counterparty?: string
  status: string
  deadline: string
  createdAt: string
}) {
  const variant = getOrderStatusBadgeVariant(status)
  const statusLabel = getOrderStatusLabel(status)
  const isExpired = Number(deadline) > 0 && Number(deadline) < Math.floor(Date.now() / 1000)
  const displayStatus = isExpired && status === 'pending' ? 'expired' : status

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-edge/15 hover:bg-surface/30 transition-colors duration-100">
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_100px_120px_80px] gap-4 flex-1 items-center">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-dust bg-surface/40 px-1.5 py-0.5 rounded shrink-0">
            {label}
          </span>
          <span className="text-sm text-chalk font-mono truncate">{id.slice(0, 10)}...{id.slice(-6)}</span>
          {counterparty && (
            <span className="text-[11px] text-dust truncate">{formatAddress(counterparty)}</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-dust tabular-nums">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-xs tabular-nums ${isExpired ? 'text-nova' : 'text-dust'}`}>
            {Number(deadline) > 0
              ? new Date(Number(deadline) * 1000).toLocaleDateString()
              : '—'}
          </span>
        </div>
        <div className="flex justify-center">
          <Badge
            variant={isExpired && status === 'pending' ? 'expired' : variant}
            className="h-[20px] text-[9px] px-2 py-0 uppercase font-bold"
          >
            {isExpired && status === 'pending' ? 'Expired' : statusLabel}
          </Badge>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-dust bg-surface/40 px-1.5 py-0.5 rounded shrink-0">
            {label}
          </span>
          <span className="text-sm text-chalk font-mono truncate">{id.slice(0, 10)}...</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={isExpired && status === 'pending' ? 'expired' : variant}
            className="h-[18px] text-[9px] px-1.5 py-0 uppercase font-bold"
          >
            {isExpired && displayStatus === 'expired' ? 'Expired' : statusLabel}
          </Badge>
          <span className="text-[10px] text-dust">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}

function CollectionOfferRows({ items }: { items: CollectionOfferRow[] }) {
  return (
    <div className="flex flex-col">
      {items.map((offer) => (
        <T1Row
          key={offer.id}
          label="Collection"
          id={offer.id}
          counterparty={offer.collection_address}
          status={offer.status}
          deadline={offer.deadline}
          createdAt={offer.created_at}
        />
      ))}
    </div>
  )
}

function RefinanceRows({ items }: { items: RefinanceRow[] }) {
  return (
    <div className="flex flex-col">
      {items.map((offer) => (
        <T1Row
          key={offer.id}
          label="Refinance"
          id={offer.id}
          counterparty={offer.inscription_id}
          status={offer.status}
          deadline={offer.deadline}
          createdAt={offer.created_at}
        />
      ))}
    </div>
  )
}

function RenegotiationRows({ items }: { items: RenegotiationRow[] }) {
  return (
    <div className="flex flex-col">
      {items.map((proposal) => (
        <T1Row
          key={proposal.id}
          label="Renegotiation"
          id={proposal.id}
          counterparty={proposal.inscription_id}
          status={proposal.status}
          deadline={proposal.deadline}
          createdAt={proposal.created_at}
        />
      ))}
    </div>
  )
}

/* Tab config — full static class strings so Tailwind doesn't purge them */
const TAB_CONFIG = [
  { value: 'active', label: 'Active', activeClass: 'data-[state=active]:text-star data-[state=active]:after:bg-star' },
  { value: 'pending', label: 'Pending', activeClass: 'data-[state=active]:text-aurora data-[state=active]:after:bg-aurora' },
  { value: 'history', label: 'History', activeClass: 'data-[state=active]:text-cosmic data-[state=active]:after:bg-cosmic' },
] as const

const PENDING_ORDER_STATUSES = new Set(['pending', 'matched'])
const HISTORY_ORDER_STATUSES = new Set(['expired', 'cancelled', 'settled'])

export default function PortfolioPage() {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { lending, borrowing, repaid, redeemable, orders, borrowingOrders, lendingOrders, swapOrders, collectionOffers, refinanceOffers, renegotiations, isLoading, error } = usePortfolio(normalized)
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()

  /* ---- Compute merged data for 3 tabs ---- */

  // Active: lending inscriptions + borrowing inscriptions + non-pending lending/borrowing orders
  const activeLendingInscriptions = useMemo(
    () => q ? lending.filter((ins) => matchesSearch(q, ins)) : lending,
    [lending, q],
  )
  const activeBorrowingInscriptions = useMemo(
    () => q ? borrowing.filter((ins) => matchesSearch(q, ins)) : borrowing,
    [borrowing, q],
  )
  const activeLendingOrders = useMemo(
    () => q ? lendingOrders.filter((o) => matchesOrderSearch(q, o)) : lendingOrders,
    [lendingOrders, q],
  )
  const activeBorrowingOrders = useMemo(
    () => q ? borrowingOrders.filter((o) => matchesOrderSearch(q, o)) : borrowingOrders,
    [borrowingOrders, q],
  )
  // Active T1: matched collection offers, refinances, renegotiations
  const activeCollectionOffers = useMemo(() => {
    const filtered = collectionOffers.filter((o) => o.status === 'matched')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [collectionOffers, q])
  const activeRefinances = useMemo(() => {
    const filtered = refinanceOffers.filter((o) => o.status === 'matched')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [refinanceOffers, q])
  const activeRenegotiations = useMemo(() => {
    const filtered = renegotiations.filter((o) => o.status === 'matched')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [renegotiations, q])

  const activeCount = activeLendingInscriptions.length + activeBorrowingInscriptions.length +
    activeLendingOrders.length + activeBorrowingOrders.length +
    activeCollectionOffers.length + activeRefinances.length + activeRenegotiations.length

  // Pending: pending orders + pending swap orders
  const pendingOrders = useMemo(() => {
    const filtered = orders.filter((o) => PENDING_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [orders, q])
  const pendingSwaps = useMemo(() => {
    const filtered = swapOrders.filter((o) => PENDING_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [swapOrders, q])

  // Pending T1: pending collection offers, refinances, renegotiations
  const pendingCollectionOffers = useMemo(() => {
    const filtered = collectionOffers.filter((o) => o.status === 'pending')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [collectionOffers, q])
  const pendingRefinances = useMemo(() => {
    const filtered = refinanceOffers.filter((o) => o.status === 'pending')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [refinanceOffers, q])
  const pendingRenegotiations = useMemo(() => {
    const filtered = renegotiations.filter((o) => o.status === 'pending')
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [renegotiations, q])

  const pendingCount = pendingOrders.length + pendingSwaps.length +
    pendingCollectionOffers.length + pendingRefinances.length + pendingRenegotiations.length

  // History: repaid + redeemable + expired/cancelled orders + settled swaps
  const filteredRepaid = useMemo(
    () => q ? repaid.filter((ins) => matchesSearch(q, ins)) : repaid,
    [repaid, q],
  )
  const filteredRedeemable = useMemo(
    () => q ? redeemable.filter((ins) => matchesSearch(q, ins)) : redeemable,
    [redeemable, q],
  )
  const historyOrders = useMemo(() => {
    const filtered = orders.filter((o) => HISTORY_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [orders, q])
  const historySwaps = useMemo(() => {
    const filtered = swapOrders.filter((o) => HISTORY_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [swapOrders, q])

  // History T1: expired/cancelled/settled collection offers, refinances, renegotiations
  const historyCollectionOffers = useMemo(() => {
    const filtered = collectionOffers.filter((o) => HISTORY_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [collectionOffers, q])
  const historyRefinances = useMemo(() => {
    const filtered = refinanceOffers.filter((o) => HISTORY_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [refinanceOffers, q])
  const historyRenegotiations = useMemo(() => {
    const filtered = renegotiations.filter((o) => HISTORY_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesT1Search(q, o)) : filtered
  }, [renegotiations, q])

  const historyCount = filteredRepaid.length + filteredRedeemable.length +
    historyOrders.length + historySwaps.length +
    historyCollectionOffers.length + historyRefinances.length + historyRenegotiations.length

  /* Smart default tab */
  const defaultTab = useMemo(() => {
    const hasActive = lending.length > 0 || borrowing.length > 0 ||
      lendingOrders.length > 0 || borrowingOrders.length > 0 ||
      collectionOffers.some((o) => o.status === 'matched') ||
      refinanceOffers.some((o) => o.status === 'matched') ||
      renegotiations.some((o) => o.status === 'matched')
    if (hasActive) return 'active'

    const hasPending = orders.some((o) => PENDING_ORDER_STATUSES.has(o.status)) ||
      swapOrders.some((o) => PENDING_ORDER_STATUSES.has(o.status)) ||
      collectionOffers.some((o) => o.status === 'pending') ||
      refinanceOffers.some((o) => o.status === 'pending') ||
      renegotiations.some((o) => o.status === 'pending')
    if (hasPending) return 'pending'

    return 'history'
  }, [lending, borrowing, orders, lendingOrders, borrowingOrders, swapOrders, collectionOffers, refinanceOffers, renegotiations])

  /* Tab counts */
  const tabCounts: Record<string, number> = {
    active: activeCount,
    pending: pendingCount,
    history: historyCount,
  }

  const totalPositions = lending.length + borrowing.length + repaid.length + redeemable.length + orders.length + swapOrders.length +
    collectionOffers.length + refinanceOffers.length + renegotiations.length

  const hasRedeemable = redeemable.length > 0

  const warnedIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (isLoading || borrowing.length === 0) return
    const now = Math.floor(Date.now() / 1000)
    for (const ins of borrowing) {
      if (ins.computedStatus !== 'filled') continue
      if (!ins.signed_at || Number(ins.signed_at) <= 0) continue
      if (warnedIdsRef.current.has(ins.id)) continue
      const maturity = Number(ins.signed_at) + Number(ins.duration)
      const remaining = maturity - now
      if (remaining > 0 && remaining < 86400) {
        warnedIdsRef.current.add(ins.id)
        const hours = Math.floor(remaining / 3600)
        const minutes = Math.floor((remaining % 3600) / 60)
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
        toast.warning(`Loan ${ins.id.slice(0, 10)}... matures in ${timeStr}`, {
          description: 'Repay before maturity to avoid liquidation.',
          duration: 8000,
        })
      }
    }
  }, [borrowing, isLoading])

  return (
    <div className="animate-fade-up pb-24">
      {/* Actions */}
      <div className="flex justify-end mb-6">
        <Link
          href="/trade"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star"><path d="M6 2v8M2 6h8" /></svg>
          Trade
        </Link>
      </div>

      <Web3ActionWrapper message="to view your positions on StarkNet">
        {/* Error */}
        {error && (
          <div className="text-center py-24">
            <p className="text-nova text-sm">Failed to load positions</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && !error && (
          <div role="status" aria-busy="true" aria-label="Loading portfolio">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl bg-surface/20" />
              ))}
            </div>
            <span className="sr-only">Loading portfolio...</span>
          </div>
        )}

        {/* Loaded content */}
        {!isLoading && !error && (
          <>
            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" aria-hidden="true" />
              <Input
                placeholder="Search by token, address, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-surface/30 border-edge/40 focus:border-star/50 rounded-xl transition-colors"
                aria-label="Search portfolio positions"
              />
            </div>

            {totalPositions === 0 ? (
              /* Global empty state */
              <div className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
                    <rect x="4" y="4" width="20" height="20" rx="4" />
                    <path d="M10 14h8M14 10v8" />
                  </svg>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-chalk text-sm font-medium">No positions yet</p>
                  <p className="text-dust text-xs max-w-xs leading-relaxed">
                    Inscribe a new agreement to begin your legacy on StarkNet.
                  </p>
                </div>
                <Link
                  href="/trade"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star"><path d="M6 2v8M2 6h8" /></svg>
                  Trade
                </Link>
              </div>
            ) : (
              <Tabs defaultValue={defaultTab}>
                <TabsList variant="line" className="mb-4 overflow-x-auto">
                  {TAB_CONFIG.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`text-chalk ${tab.activeClass}`}
                    >
                      <span className="relative inline-flex items-center">
                        {tab.label}
                        {tab.value === 'history' && hasRedeemable && (
                          <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-star animate-pulse" />
                        )}
                      </span>
                      {tabCounts[tab.value] > 0 && (
                        <span className="ml-1.5 text-[10px] font-mono bg-surface/60 px-1.5 py-0.5 rounded-md">
                          {tabCounts[tab.value]}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Active tab */}
                <TabsContent value="active">
                  {activeCount === 0 ? (
                    <EmptyTab
                      message={q ? 'No active positions match your search.' : 'No active positions yet.'}
                      cta={!q ? { label: 'Browse Markets', href: '/markets' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />

                      {/* Lending sub-section */}
                      {(activeLendingInscriptions.length > 0 || activeLendingOrders.length > 0) && (
                        <>
                          <SectionHeading label="Lending" />
                          {activeLendingOrders.length > 0 && (
                            <div className="flex flex-col">
                              {activeLendingOrders.map((order) => (
                                <OrderListRow key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                          <InscriptionList items={activeLendingInscriptions} />
                        </>
                      )}

                      {/* Borrowing sub-section */}
                      {(activeBorrowingInscriptions.length > 0 || activeBorrowingOrders.length > 0) && (
                        <>
                          <SectionHeading label="Borrowing" />
                          {activeBorrowingOrders.length > 0 && (
                            <div className="flex flex-col">
                              {activeBorrowingOrders.map((order) => (
                                <OrderListRow key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                          <InscriptionList items={activeBorrowingInscriptions} />
                        </>
                      )}

                      {/* Active T1 entities (matched) */}
                      {(activeCollectionOffers.length > 0 || activeRefinances.length > 0 || activeRenegotiations.length > 0) && (
                        <>
                          <SectionHeading label="Offers & Proposals" />
                          {activeCollectionOffers.length > 0 && <CollectionOfferRows items={activeCollectionOffers} />}
                          {activeRefinances.length > 0 && <RefinanceRows items={activeRefinances} />}
                          {activeRenegotiations.length > 0 && <RenegotiationRows items={activeRenegotiations} />}
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Pending tab */}
                <TabsContent value="pending">
                  {pendingCount === 0 ? (
                    <EmptyTab
                      message={q ? 'No pending items match your search.' : 'No pending orders or swaps.'}
                      cta={!q ? { label: 'Create Order', href: '/borrow' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      {(pendingOrders.length > 0 || pendingSwaps.length > 0) && (
                        <>
                          <ListingTableHeader />
                          <div className="flex flex-col">
                            {pendingOrders.map((order) => (
                              <OrderListRow key={order.id} order={order} />
                            ))}
                            {pendingSwaps.map((order) => (
                              <OrderListRow key={order.id} order={order} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Pending T1 entities */}
                      {(pendingCollectionOffers.length > 0 || pendingRefinances.length > 0 || pendingRenegotiations.length > 0) && (
                        <>
                          <SectionHeading label="Offers & Proposals" />
                          {pendingCollectionOffers.length > 0 && <CollectionOfferRows items={pendingCollectionOffers} />}
                          {pendingRefinances.length > 0 && <RefinanceRows items={pendingRefinances} />}
                          {pendingRenegotiations.length > 0 && <RenegotiationRows items={pendingRenegotiations} />}
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* History tab */}
                <TabsContent value="history">
                  {historyCount === 0 ? (
                    <EmptyTab message={q ? 'No history items match your search.' : 'No history yet.'} />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />

                      {/* Redeemable positions first (most actionable) */}
                      {filteredRedeemable.length > 0 && (
                        <>
                          <SectionHeading label="Redeemable" />
                          <InscriptionList items={filteredRedeemable} />
                        </>
                      )}

                      {/* Repaid positions */}
                      {filteredRepaid.length > 0 && (
                        <>
                          <SectionHeading label="Repaid" />
                          <InscriptionList items={filteredRepaid} />
                        </>
                      )}

                      {/* Expired/cancelled/settled orders */}
                      {(historyOrders.length > 0 || historySwaps.length > 0) && (
                        <>
                          <SectionHeading label="Past Orders" />
                          <div className="flex flex-col">
                            {historyOrders.map((order) => (
                              <OrderListRow key={order.id} order={order} />
                            ))}
                            {historySwaps.map((order) => (
                              <OrderListRow key={order.id} order={order} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* History T1 entities */}
                      {(historyCollectionOffers.length > 0 || historyRefinances.length > 0 || historyRenegotiations.length > 0) && (
                        <>
                          <SectionHeading label="Past Offers & Proposals" />
                          {historyCollectionOffers.length > 0 && <CollectionOfferRows items={historyCollectionOffers} />}
                          {historyRefinances.length > 0 && <RefinanceRows items={historyRefinances} />}
                          {historyRenegotiations.length > 0 && <RenegotiationRows items={historyRenegotiations} />}
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </Web3ActionWrapper>

      {/* ── FAQ Section ──────────────────────────────────────── */}
      <PortfolioInfoSection />
    </div>
  )
}

/* ── FAQ Section ──────────────────────────────────────────── */

const PORTFOLIO_FAQ = [
  {
    q: 'What does this page show?',
    a: 'All your positions: active loans, pending orders, shares, and collection/refinance/renegotiation offers.',
  },
  {
    q: 'What are shares?',
    a: 'ERC1155 tokens representing your lending position. Burn them after repayment for debt + interest, or after liquidation for collateral.',
  },
  {
    q: 'What do the status badges mean?',
    a: 'Open = waiting for a lender. Filled = active loan. Repaid = claim your assets. Liquidated = claim collateral.',
  },
  {
    q: 'How do I claim my assets?',
    a: 'Click into any repaid or liquidated position where you hold shares, then click "Redeem" to burn shares and receive your assets.',
  },
]

function PortfolioFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-edge/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
      >
        <span className="text-sm text-chalk group-hover:text-star transition-colors pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-dust shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-dust leading-relaxed pb-4 pr-8">{a}</p>
      )}
    </div>
  )
}

function PortfolioInfoSection() {
  return (
    <div className="mt-16 max-w-lg mx-auto">
      {/* Hero statement */}
      <section className="text-center mb-10">
        <p className="text-star font-mono text-[10px] uppercase tracking-[0.3em] mb-3">
          Your Positions on StarkNet
        </p>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-chalk leading-[1.15] mb-4">
          Track everything, <span className="text-star">claim anytime.</span>
        </h2>
        <p className="text-dust text-sm leading-relaxed max-w-md mx-auto">
          Active loans, pending orders, redeemable shares. Every position isolated with its own Locker contract.
        </p>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-12 py-6 border-t border-b border-edge/15">
        <div className="text-center">
          <div className="font-display text-xl text-chalk">ERC1155</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Share Standard</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">0%</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Redeem Fee</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">Isolated</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Per Position</div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-display text-lg text-chalk uppercase tracking-wider mb-1">Questions?</h2>
        <p className="text-dust text-sm mb-6">Answers.</p>
        <div>
          {PORTFOLIO_FAQ.map((item) => (
            <PortfolioFaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-dust/60 uppercase tracking-widest">
        <span>Open Source</span>
        <span className="text-edge/40">|</span>
        <span>Immutable</span>
        <span className="text-edge/40">|</span>
        <span>StarkNet</span>
      </div>
    </div>
  )
}
