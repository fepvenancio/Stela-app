'use client'

import { useState, useMemo } from 'react'
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
import { Search, Plus } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

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
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-star" />
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

/* Tab config — full static class strings so Tailwind doesn't purge them */
const TAB_CONFIG = [
  { value: 'orders', label: 'Orders', activeClass: 'data-[state=active]:text-star data-[state=active]:after:bg-star' },
  { value: 'swaps', label: 'Swaps', activeClass: 'data-[state=active]:text-aurora data-[state=active]:after:bg-aurora' },
  { value: 'lending', label: 'Lending', activeClass: 'data-[state=active]:text-star data-[state=active]:after:bg-star' },
  { value: 'borrowing', label: 'Borrowing', activeClass: 'data-[state=active]:text-nebula data-[state=active]:after:bg-nebula' },
  { value: 'repaid', label: 'Repaid', activeClass: 'data-[state=active]:text-aurora data-[state=active]:after:bg-aurora' },
  { value: 'redeemable', label: 'Redeemable', activeClass: 'data-[state=active]:text-cosmic data-[state=active]:after:bg-cosmic' },
] as const

export default function PortfolioPage() {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { lending, borrowing, repaid, redeemable, orders, borrowingOrders, lendingOrders, swapOrders, isLoading, error } = usePortfolio(normalized)
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()

  const filteredLending = useMemo(
    () => q ? lending.filter((ins) => matchesSearch(q, ins)) : lending,
    [lending, q],
  )
  const filteredBorrowing = useMemo(
    () => q ? borrowing.filter((ins) => matchesSearch(q, ins)) : borrowing,
    [borrowing, q],
  )
  const filteredRedeemable = useMemo(
    () => q ? redeemable.filter((ins) => matchesSearch(q, ins)) : redeemable,
    [redeemable, q],
  )
  const filteredRepaid = useMemo(
    () => q ? repaid.filter((ins) => matchesSearch(q, ins)) : repaid,
    [repaid, q],
  )
  const filteredOrders = useMemo(
    () => q ? orders.filter((o) => matchesOrderSearch(q, o)) : orders,
    [orders, q],
  )
  const filteredSwaps = useMemo(
    () => q ? swapOrders.filter((o) => matchesOrderSearch(q, o)) : swapOrders,
    [swapOrders, q],
  )

  /* Smart default tab */
  const defaultTab = useMemo(() => {
    if (swapOrders.length > 0) return 'swaps'
    if (lending.length > 0 || lendingOrders.length > 0) return 'lending'
    if (borrowing.length > 0 || borrowingOrders.length > 0) return 'borrowing'
    if (orders.length > 0) return 'orders'
    if (redeemable.length > 0) return 'redeemable'
    return 'orders'
  }, [lending, borrowing, orders, redeemable, lendingOrders, borrowingOrders, swapOrders])

  /* Tab counts */
  const tabCounts: Record<string, number> = {
    orders: filteredOrders.length,
    swaps: filteredSwaps.length,
    lending: filteredLending.length + lendingOrders.length,
    borrowing: filteredBorrowing.length + borrowingOrders.length,
    repaid: filteredRepaid.length,
    redeemable: filteredRedeemable.length,
  }

  const totalPositions = lending.length + borrowing.length + repaid.length + redeemable.length + orders.length + swapOrders.length

  return (
    <div className="animate-fade-up pb-24">
      {/* Header */}
      <div className="flex items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
            Portfolio
          </h1>
          <p className="text-dust max-w-lg leading-relaxed">
            Your lending positions and borrowing history on StarkNet.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-star" />
          Inscribe
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
                  href="/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-star" />
                  Inscribe a Stela
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
                      {tab.label}
                      {tabCounts[tab.value] > 0 && (
                        <span className="ml-1.5 text-[10px] font-mono bg-surface/60 px-1.5 py-0.5 rounded-md">
                          {tabCounts[tab.value]}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="orders">
                  {filteredOrders.length === 0 ? (
                    <EmptyTab
                      message={q ? 'No orders match your search.' : 'No off-chain orders yet.'}
                      cta={!q ? { label: 'Create Order', href: '/create' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      <div className="flex flex-col">
                        {filteredOrders.map((order) => (
                          <OrderListRow key={order.id} order={order} />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="swaps">
                  {filteredSwaps.length === 0 ? (
                    <EmptyTab
                      message={q ? 'No swaps match your search.' : 'No swaps yet.'}
                      cta={!q ? { label: 'Create Swap', href: '/create' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      <div className="flex flex-col">
                        {filteredSwaps.map((order) => (
                          <OrderListRow key={order.id} order={order} />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="lending">
                  {filteredLending.length === 0 && lendingOrders.length === 0 ? (
                    <EmptyTab
                      message={q ? 'No lending positions match your search.' : 'No lending positions yet.'}
                      cta={!q ? { label: 'Browse Stelas', href: '/browse' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      {lendingOrders.length > 0 && (
                        <div className="flex flex-col">
                          {lendingOrders.map((order) => (
                            <OrderListRow key={order.id} order={order} />
                          ))}
                        </div>
                      )}
                      <InscriptionList items={filteredLending} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="borrowing">
                  {filteredBorrowing.length === 0 && borrowingOrders.length === 0 ? (
                    <EmptyTab
                      message={q ? 'No borrowing positions match your search.' : 'No borrowing positions yet.'}
                      cta={!q ? { label: 'Create Inscription', href: '/create' } : undefined}
                    />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      {borrowingOrders.length > 0 && (
                        <div className="flex flex-col">
                          {borrowingOrders.map((order) => (
                            <OrderListRow key={order.id} order={order} />
                          ))}
                        </div>
                      )}
                      <InscriptionList items={filteredBorrowing} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="repaid">
                  {filteredRepaid.length === 0 ? (
                    <EmptyTab message={q ? 'No repaid positions match your search.' : 'No repaid positions yet.'} />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      <InscriptionList items={filteredRepaid} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="redeemable">
                  {filteredRedeemable.length === 0 ? (
                    <EmptyTab message={q ? 'No redeemable positions match your search.' : 'No redeemable positions.'} />
                  ) : (
                    <div className="rounded-xl border border-edge/30 overflow-clip">
                      <ListingTableHeader />
                      <InscriptionList items={filteredRedeemable} />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </Web3ActionWrapper>
    </div>
  )
}
