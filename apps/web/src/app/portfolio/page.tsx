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
import { Search } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import type { OrderRow } from '@/hooks/useOrders'
import Link from 'next/link'

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-dust text-sm">{message}</p>
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

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Portfolio
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          Your lending positions and borrowing history on StarkNet.
        </p>
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
              {Array.from({ length: 8 }).map((_, i) => (
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
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" aria-hidden="true" />
              <Input
                placeholder="Search by token, address, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-surface/40 border-edge/50 focus:border-star/50 transition-colors"
                aria-label="Search portfolio positions"
              />
            </div>

            <Tabs defaultValue={lending.length === 0 && lendingOrders.length === 0 && (borrowing.length > 0 || borrowingOrders.length > 0) ? 'borrowing' : orders.length > 0 && lending.length === 0 && lendingOrders.length === 0 ? 'orders' : 'lending'}>
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="orders" className="text-chalk data-[state=active]:text-star after:bg-star">
                  Orders{filteredOrders.length > 0 && ` (${filteredOrders.length})`}
                </TabsTrigger>
                <TabsTrigger value="lending" className="text-chalk data-[state=active]:text-star after:bg-star">
                  Lending{(filteredLending.length + lendingOrders.length) > 0 && ` (${filteredLending.length + lendingOrders.length})`}
                </TabsTrigger>
                <TabsTrigger value="borrowing" className="text-chalk data-[state=active]:text-nebula after:bg-nebula">
                  Borrowing{(filteredBorrowing.length + borrowingOrders.length) > 0 && ` (${filteredBorrowing.length + borrowingOrders.length})`}
                </TabsTrigger>
                <TabsTrigger value="repaid" className="text-chalk data-[state=active]:text-aurora after:bg-aurora">
                  Repaid{filteredRepaid.length > 0 && ` (${filteredRepaid.length})`}
                </TabsTrigger>
                <TabsTrigger value="redeemable" className="text-chalk data-[state=active]:text-cosmic after:bg-cosmic">
                  Redeemable{filteredRedeemable.length > 0 && ` (${filteredRedeemable.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="orders">
                {filteredOrders.length === 0 ? (
                  <EmptyTab message={q ? 'No orders match your search.' : 'No off-chain orders yet.'} />
                ) : (
                  <div className="rounded-lg border border-edge/30 overflow-hidden">
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
                  <EmptyTab message={q ? 'No lending positions match your search.' : 'No lending positions yet.'} />
                ) : (
                  <div className="rounded-lg border border-edge/30 overflow-hidden">
                    <ListingTableHeader />
                    <div className="flex flex-col">
                      {lendingOrders.map((order) => (
                        <OrderListRow key={order.id} order={order} />
                      ))}
                    </div>
                    <InscriptionList items={filteredLending} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="borrowing">
                {filteredBorrowing.length === 0 && borrowingOrders.length === 0 ? (
                  <EmptyTab message={q ? 'No borrowing positions match your search.' : 'No borrowing positions yet.'} />
                ) : (
                  <div className="rounded-lg border border-edge/30 overflow-hidden">
                    <ListingTableHeader />
                    <div className="flex flex-col">
                      {borrowingOrders.map((order) => (
                        <OrderListRow key={order.id} order={order} />
                      ))}
                    </div>
                    <InscriptionList items={filteredBorrowing} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="repaid">
                {filteredRepaid.length === 0 ? (
                  <EmptyTab message={q ? 'No repaid positions match your search.' : 'No repaid positions yet.'} />
                ) : (
                  <div className="rounded-lg border border-edge/30 overflow-hidden">
                    <ListingTableHeader />
                    <InscriptionList items={filteredRepaid} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="redeemable">
                {filteredRedeemable.length === 0 ? (
                  <EmptyTab message={q ? 'No redeemable positions match your search.' : 'No redeemable positions.'} />
                ) : (
                  <div className="rounded-lg border border-edge/30 overflow-hidden">
                    <ListingTableHeader />
                    <InscriptionList items={filteredRedeemable} />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Global empty state when user has no positions at all */}
            {lending.length === 0 && borrowing.length === 0 && repaid.length === 0 && redeemable.length === 0 && orders.length === 0 && (
              <div className="text-center py-16">
                <p className="text-ash text-sm max-w-xs mx-auto leading-relaxed">
                  Your personal library of stelas is empty. Inscribe a new agreement to begin your legacy.
                </p>
                <Button asChild variant="outline" className="mt-6 border-edge hover:border-star/30 rounded-full px-8">
                  <Link href="/create">Inscribe a Stela</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </Web3ActionWrapper>
    </div>
  )
}
