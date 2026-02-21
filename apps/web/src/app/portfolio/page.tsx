'use client'

import { useAccount } from '@starknet-react/core'
import { useInscriptions } from '@/hooks/useInscriptions'
import { InscriptionCard } from '@/components/InscriptionCard'
import { InscriptionCardSkeleton } from '@/components/InscriptionCardSkeleton'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { data, isLoading, error } = useInscriptions(
    address ? { address } : undefined
  )

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
        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <InscriptionCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-24">
            <p className="text-nova text-sm">Failed to load positions</p>
          </div>
        )}

        {/* Cards */}
        {!isLoading && data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((a, i) => (
              <div key={a.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
                <InscriptionCard
                  id={a.id}
                  status={a.status}
                  creator={a.creator}
                  multiLender={a.multi_lender}
                  duration={a.duration}
                  assets={a.assets ?? []}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && data.length === 0 && (
          <div className="text-center py-32">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-surface border border-edge/30 mb-6 group hover:border-star/30 transition-all">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash group-hover:text-star transition-colors">
                <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
              </svg>
            </div>
            <p className="text-dust text-lg font-display uppercase tracking-widest">No Inscriptions Found</p>
            <p className="text-ash text-sm mt-2 max-w-xs mx-auto leading-relaxed">Your personal library of stelas is empty. Inscribe a new agreement to begin your legacy.</p>
            <Button asChild variant="outline" className="mt-8 border-edge hover:border-star/30 rounded-full px-8">
              <Link href="/create">Inscribe a Stela</Link>
            </Button>
          </div>
        )}
      </Web3ActionWrapper>
    </div>
  )
}
