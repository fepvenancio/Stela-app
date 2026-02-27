'use client'

import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { SummaryBar } from '@/components/portfolio/SummaryBar'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { EnrichedInscription } from '@/hooks/usePortfolio'
import Link from 'next/link'

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-surface border border-edge/30 mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
          <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
        </svg>
      </div>
      <p className="text-dust text-sm">{message}</p>
    </div>
  )
}

function TableHeader() {
  return (
    <div className="hidden md:flex items-center gap-4 px-3 pb-2 text-[9px] text-dust uppercase tracking-widest font-semibold">
      <div className="shrink-0 w-5" />
      <div className="grid grid-cols-12 gap-4 flex-1">
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Debt</div>
        <div className="col-span-2">Interest</div>
        <div className="col-span-3">Collateral</div>
        <div className="col-span-2 text-right">Duration</div>
      </div>
    </div>
  )
}

function InscriptionList({ items }: { items: EnrichedInscription[] }) {
  return (
    <>
      {items.length > 0 && <TableHeader />}
      <div className="flex flex-col gap-3">
        {items.map((ins, i) => (
          <div key={ins.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-up">
            <InscriptionListRow
              id={ins.id}
              status={ins.computedStatus}
              creator={ins.creator}
              multiLender={ins.multi_lender}
              duration={ins.duration}
              assets={ins.assets ?? []}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export default function PortfolioPage() {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { lending, borrowing, redeemable, summary, isLoading, error } = usePortfolio(normalized)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Dashboard
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
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full bg-surface/20 rounded-xl" />
              ))}
            </div>
            <span className="sr-only">Loading portfolio...</span>
          </div>
        )}

        {/* Loaded content */}
        {!isLoading && !error && (
          <>
            <SummaryBar summary={summary} />

            <Tabs defaultValue="lending">
              <TabsList variant="line" className="mb-6">
                <TabsTrigger value="lending" className="text-chalk data-[state=active]:text-star after:bg-star">
                  Lending{lending.length > 0 && ` (${lending.length})`}
                </TabsTrigger>
                <TabsTrigger value="borrowing" className="text-chalk data-[state=active]:text-nebula after:bg-nebula">
                  Borrowing{borrowing.length > 0 && ` (${borrowing.length})`}
                </TabsTrigger>
                <TabsTrigger value="redeemable" className="text-chalk data-[state=active]:text-cosmic after:bg-cosmic">
                  Redeemable{redeemable.length > 0 && ` (${redeemable.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lending">
                {lending.length === 0 ? (
                  <EmptyTab message="No lending positions yet. Browse open inscriptions to start lending." />
                ) : (
                  <InscriptionList items={lending} />
                )}
              </TabsContent>

              <TabsContent value="borrowing">
                {borrowing.length === 0 ? (
                  <EmptyTab message="No borrowing positions yet. Create an inscription to start borrowing." />
                ) : (
                  <InscriptionList items={borrowing} />
                )}
              </TabsContent>

              <TabsContent value="redeemable">
                {redeemable.length === 0 ? (
                  <EmptyTab message="No redeemable positions. Positions appear here after repayment or liquidation." />
                ) : (
                  <InscriptionList items={redeemable} />
                )}
              </TabsContent>
            </Tabs>

            {/* Global empty state when user has no positions at all */}
            {lending.length === 0 && borrowing.length === 0 && redeemable.length === 0 && (
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
