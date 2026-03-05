'use client'

import { useState, useMemo } from 'react'
import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { SummaryBar } from '@/components/portfolio/SummaryBar'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

function EmptyTab({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-surface/40 border border-edge/20 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <path d="M7 10h6M10 7v6" />
        </svg>
      </div>
      <p className="text-dust text-sm text-center max-w-xs">{message}</p>
      {cta && (
        <Button asChild variant="outline" size="sm" className="rounded-full px-6 gap-1.5">
          <Link href={cta.href}>
            <Plus className="w-3.5 h-3.5" />
            {cta.label}
          </Link>
        </Button>
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
          isPrivateLender={ins.isPrivateLender}
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

/* Tab config for cleaner rendering */
const TAB_CONFIG = [
  { value: 'orders', label: 'Orders', activeClass: 'text-star', afterClass: 'after:bg-star' },
  { value: 'lending', label: 'Lending', activeClass: 'text-star', afterClass: 'after:bg-star' },
  { value: 'borrowing', label: 'Borrowing', activeClass: 'text-nebula', afterClass: 'after:bg-nebula' },
  { value: 'repaid', label: 'Repaid', activeClass: 'text-aurora', afterClass: 'after:bg-aurora' },
  { value: 'redeemable', label: 'Redeemable', activeClass: 'text-cosmic', afterClass: 'after:bg-cosmic' },
] as const

export default function PortfolioPage() {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { lending, borrowing, repaid, redeemable, orders, borrowingOrders, lendingOrders, summary, isLoading, error } = usePortfolio(normalized)
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

  /* Smart default tab */
  const defaultTab = useMemo(() => {
    if (lending.length > 0 || lendingOrders.length > 0) return 'lending'
    if (borrowing.length > 0 || borrowingOrders.length > 0) return 'borrowing'
    if (orders.length > 0) return 'orders'
    if (redeemable.length > 0) return 'redeemable'
    return 'orders'
  }, [lending, borrowing, orders, redeemable, lendingOrders, borrowingOrders])

  /* Tab counts */
  const tabCounts: Record<string, number> = {
    orders: filteredOrders.length,
    lending: filteredLending.length + lendingOrders.length,
    borrowing: filteredBorrowing.length + borrowingOrders.length,
    repaid: filteredRepaid.length,
    redeemable: filteredRedeemable.length,
  }

  const totalPositions = lending.length + borrowing.length + repaid.length + redeemable.length + orders.length

  return (
    <div className="animate-fade-up max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-2 uppercase">
            Portfolio
          </h1>
          <p className="text-dust text-sm leading-relaxed">
            Your lending positions and borrowing history on StarkNet.
          </p>
        </div>
        <Button asChild variant="gold" size="sm" className="shrink-0 gap-1.5 rounded-full px-5">
          <Link href="/create">
            <Plus className="w-3.5 h-3.5" />
            Inscribe
          </Link>
        </Button>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-surface/20 border border-edge/20" />
              ))}
            </div>
            <div className="space-y-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full bg-surface/10" />
              ))}
            </div>
            <span className="sr-only">Loading portfolio...</span>
          </div>
        )}

        {/* Loaded content */}
        {!isLoading && !error && (
          <>
            <SummaryBar summary={summary} />

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
                <div className="w-16 h-16 rounded-3xl bg-star/5 border border-star/15 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star/60">
                    <rect x="4" y="4" width="20" height="20" rx="4" />
                    <path d="M10 14h8M14 10v8" />
                  </svg>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-chalk text-sm font-medium">No positions yet</p>
                  <p className="text-ash text-xs max-w-xs leading-relaxed">
                    Inscribe a new agreement to begin your legacy on StarkNet.
                  </p>
                </div>
                <Button asChild variant="gold" className="rounded-full px-8 gap-1.5">
                  <Link href="/create">
                    <Plus className="w-4 h-4" />
                    Inscribe a Stela
                  </Link>
                </Button>
              </div>
            ) : (
              <Tabs defaultValue={defaultTab}>
                <TabsList variant="line" className="mb-4">
                  {TAB_CONFIG.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`text-chalk data-[state=active]:${tab.activeClass} ${tab.afterClass}`}
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
