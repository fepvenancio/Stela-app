'use client'

import { useState } from 'react'
import { useInscriptions } from '@/hooks/useInscriptions'
import { InscriptionCard } from '@/components/InscriptionCard'
import { InscriptionCardSkeleton } from '@/components/InscriptionCardSkeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'filled', label: 'Filled' },
  { key: '', label: 'All' },
]

export default function BrowsePage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const { data, isLoading, error } = useInscriptions({ status: statusFilter })

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-chalk mb-3">
          Discover Inscriptions
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          Browse open lending inscriptions on StarkNet. Sign as a lender to earn interest, or create your own.
        </p>
      </div>

      {/* Filters */}
      <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map(({ key, label }) => (
          <ToggleGroupItem
            key={key}
            value={key}
            className="px-4 py-2 rounded-xl text-sm data-[state=on]:bg-star/15 data-[state=on]:text-star data-[state=on]:border-star/30 text-dust border border-transparent hover:text-chalk hover:bg-surface/50"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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
          <p className="text-nova text-sm">Failed to load inscriptions</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && data.length > 0 && (
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
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-edge mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
              <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
            </svg>
          </div>
          <p className="text-dust text-sm">No inscriptions found</p>
          <p className="text-ash text-xs mt-1">Try a different filter or create a new inscription</p>
        </div>
      )}
    </div>
  )
}
