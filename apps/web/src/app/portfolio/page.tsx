'use client'

import { useAccount } from '@starknet-react/core'
import { normalizeAddress } from '@/lib/address'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { SummaryBar } from '@/components/portfolio/SummaryBar'
import { PositionCard } from '@/components/portfolio/PositionCard'
import { PositionCardSkeleton } from '@/components/portfolio/PositionCardSkeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-surface border border-edge/30 mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
          <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
        </svg>
      </div>
      <p className="text-dust text-sm">{message}</p>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <PositionCardSkeleton key={i} />
      ))}
    </div>
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
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-chalk mb-3 uppercase">
          Vaults
        </h1>
        <p className="text-dust leading-relaxed">
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
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-surface/20 border border-edge/20 animate-pulse" />
              ))}
            </div>
            <LoadingGrid />
          </>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lending.map((ins, i) => (
                      <div key={ins.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
                        <PositionCard inscription={ins} role="lender" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="borrowing">
                {borrowing.length === 0 ? (
                  <EmptyTab message="No borrowing positions yet. Create an inscription to start borrowing." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {borrowing.map((ins, i) => (
                      <div key={ins.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
                        <PositionCard inscription={ins} role="borrower" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="redeemable">
                {redeemable.length === 0 ? (
                  <EmptyTab message="No redeemable positions. Positions appear here after repayment or liquidation." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {redeemable.map((ins, i) => (
                      <div key={ins.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
                        <PositionCard inscription={ins} role="redeemable" shareBalance={ins.shareBalance} />
                      </div>
                    ))}
                  </div>
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
