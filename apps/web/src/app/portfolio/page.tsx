'use client'

import { useState, useMemo } from 'react'
import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { SummaryBar } from '@/components/portfolio/SummaryBar'
import { computePortfolioSummary } from '@/lib/portfolio-utils'
import { PortfolioInscriptionRow } from '@/components/portfolio/PortfolioInscriptionRow'
import { PortfolioOrderRow } from '@/components/portfolio/PortfolioOrderRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

function EmptyTab({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <path d="M7 10h6M10 7v6" />
        </svg>
      </div>
      <p className="text-gray-400 text-sm text-center max-w-xs">{message}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent"><path d="M6 2v8M2 6h8" /></svg>
          {cta.label}
        </Link>
      )}
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
    <div className="flex items-center gap-3 px-4 py-2 bg-surface/20 border-b border-border/20">
      <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex-1 h-px bg-edge/15" />
    </div>
  )
}

/* Tab config — full static class strings so Tailwind doesn't purge them */
const TAB_CONFIG = [
  { value: 'active', label: 'Active', activeClass: 'data-[state=active]:text-accent data-[state=active]:after:bg-accent' },
  { value: 'pending', label: 'Pending', activeClass: 'data-[state=active]:text-aurora data-[state=active]:after:bg-green-500' },
  { value: 'history', label: 'History', activeClass: 'data-[state=active]:text-cosmic data-[state=active]:after:bg-cosmic' },
] as const

const PENDING_ORDER_STATUSES = new Set(['pending', 'matched'])
const HISTORY_ORDER_STATUSES = new Set(['expired', 'cancelled', 'settled'])

export default function PortfolioPage() {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { lending, borrowing, repaid, redeemable, orders, borrowingOrders, lendingOrders, swapOrders, isLoading, error } = usePortfolio(normalized)
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
  const activeCount = activeLendingInscriptions.length + activeBorrowingInscriptions.length +
    activeLendingOrders.length + activeBorrowingOrders.length

  // Pending: pending orders + pending swap orders
  const pendingOrders = useMemo(() => {
    const filtered = orders.filter((o) => PENDING_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [orders, q])
  const pendingSwaps = useMemo(() => {
    const filtered = swapOrders.filter((o) => PENDING_ORDER_STATUSES.has(o.status))
    return q ? filtered.filter((o) => matchesOrderSearch(q, o)) : filtered
  }, [swapOrders, q])
  const pendingCount = pendingOrders.length + pendingSwaps.length

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
  const historyCount = filteredRepaid.length + filteredRedeemable.length +
    historyOrders.length + historySwaps.length

  /* Smart default tab */
  const defaultTab = useMemo(() => {
    const hasActive = lending.length > 0 || borrowing.length > 0 ||
      lendingOrders.length > 0 || borrowingOrders.length > 0
    if (hasActive) return 'active'

    const hasPending = orders.some((o) => PENDING_ORDER_STATUSES.has(o.status)) ||
      swapOrders.some((o) => PENDING_ORDER_STATUSES.has(o.status))
    if (hasPending) return 'pending'

    return 'history'
  }, [lending, borrowing, orders, lendingOrders, borrowingOrders, swapOrders])

  /* Tab counts */
  const tabCounts: Record<string, number> = {
    active: activeCount,
    pending: pendingCount,
    history: historyCount,
  }

  const totalPositions = lending.length + borrowing.length + repaid.length + redeemable.length + orders.length + swapOrders.length

  const summary = useMemo(
    () => computePortfolioSummary({ lending, borrowing, redeemable, borrowingOrders, lendingOrders }),
    [lending, borrowing, redeemable, borrowingOrders, lendingOrders],
  )

  const hasRedeemable = redeemable.length > 0

  return (
    <div className="animate-fade-up pb-24">
      {/* Actions */}
      <div className="flex justify-end mb-6">
        <Link
          href="/trade"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent"><path d="M6 2v8M2 6h8" /></svg>
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <Input
                placeholder="Search by token, address, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-surface/30 border-border/40 focus:border-accent/50 rounded-xl transition-colors"
                aria-label="Search portfolio positions"
              />
            </div>

            {totalPositions === 0 ? (
              /* Global empty state */
              <div className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                    <rect x="4" y="4" width="20" height="20" rx="4" />
                    <path d="M10 14h8M14 10v8" />
                  </svg>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-white text-sm font-medium">No positions yet</p>
                  <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
                    Inscribe a new agreement to begin your legacy on StarkNet.
                  </p>
                </div>
                <Link
                  href="/trade"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent"><path d="M6 2v8M2 6h8" /></svg>
                  Trade
                </Link>
              </div>
            ) : (
              <>
              <SummaryBar summary={summary} />
              <Tabs defaultValue={defaultTab}>
                <TabsList variant="line" className="mb-4 overflow-x-auto">
                  {TAB_CONFIG.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`text-white ${tab.activeClass}`}
                    >
                      <span className="relative inline-flex items-center">
                        {tab.label}
                        {tab.value === 'history' && hasRedeemable && (
                          <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
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
                    <div className="rounded-xl border border-border/30 overflow-clip">
                      <ListingTableHeader />

                      {/* Lending sub-section */}
                      {(activeLendingInscriptions.length > 0 || activeLendingOrders.length > 0) && (
                        <>
                          <SectionHeading label="Lending" />
                          {activeLendingOrders.length > 0 && (
                            <div className="flex flex-col">
                              {activeLendingOrders.map((order) => (
                                <PortfolioOrderRow key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                          <div className="flex flex-col">
                            {activeLendingInscriptions.map((ins) => (
                              <PortfolioInscriptionRow key={ins.id} ins={ins} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Borrowing sub-section */}
                      {(activeBorrowingInscriptions.length > 0 || activeBorrowingOrders.length > 0) && (
                        <>
                          <SectionHeading label="Borrowing" />
                          {activeBorrowingOrders.length > 0 && (
                            <div className="flex flex-col">
                              {activeBorrowingOrders.map((order) => (
                                <PortfolioOrderRow key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                          <div className="flex flex-col">
                            {activeBorrowingInscriptions.map((ins) => (
                              <PortfolioInscriptionRow key={ins.id} ins={ins} />
                            ))}
                          </div>
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
                    <div className="rounded-xl border border-border/30 overflow-clip">
                      <ListingTableHeader />
                      <div className="flex flex-col">
                        {pendingOrders.map((order) => (
                          <PortfolioOrderRow key={order.id} order={order} />
                        ))}
                        {pendingSwaps.map((order) => (
                          <PortfolioOrderRow key={order.id} order={order} />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* History tab */}
                <TabsContent value="history">
                  {historyCount === 0 ? (
                    <EmptyTab message={q ? 'No history items match your search.' : 'No history yet.'} />
                  ) : (
                    <div className="rounded-xl border border-border/30 overflow-clip">
                      <ListingTableHeader />

                      {/* Redeemable positions first (most actionable) */}
                      {filteredRedeemable.length > 0 && (
                        <>
                          <SectionHeading label="Redeemable" />
                          <div className="flex flex-col">
                            {filteredRedeemable.map((ins) => (
                              <PortfolioInscriptionRow key={ins.id} ins={ins} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Repaid positions */}
                      {filteredRepaid.length > 0 && (
                        <>
                          <SectionHeading label="Repaid" />
                          <div className="flex flex-col">
                            {filteredRepaid.map((ins) => (
                              <PortfolioInscriptionRow key={ins.id} ins={ins} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Expired/cancelled/settled orders */}
                      {(historyOrders.length > 0 || historySwaps.length > 0) && (
                        <>
                          <SectionHeading label="Past Orders" />
                          <div className="flex flex-col">
                            {historyOrders.map((order) => (
                              <PortfolioOrderRow key={order.id} order={order} />
                            ))}
                            {historySwaps.map((order) => (
                              <PortfolioOrderRow key={order.id} order={order} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </>
            )}
          </>
        )}
      </Web3ActionWrapper>
    </div>
  )
}
