'use client'

import { useState } from 'react'
import { useAgreements } from '@/hooks/useAgreements'
import { AgreementCard } from '@/components/AgreementCard'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'filled', label: 'Filled' },
  { key: '', label: 'All' },
]

export default function BrowsePage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const { data, isLoading, error } = useAgreements({ status: statusFilter })

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-chalk mb-3">
          Discover Agreements
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          Browse open lending agreements on StarkNet. Sign as a lender to earn interest, or create your own.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
              statusFilter === key
                ? 'bg-star/15 text-star border border-star/30'
                : 'text-dust border border-transparent hover:text-chalk hover:bg-surface/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 py-24 justify-center">
          <div className="w-4 h-4 border-2 border-star/30 border-t-star rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
          <span className="text-dust text-sm">Loading agreements...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load agreements</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((a, i) => (
            <div key={a.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
              <AgreementCard
                id={a.id}
                status={a.status}
                creator={a.creator}
                multiLender={a.multi_lender}
                duration={a.duration}
                debtAssetCount={a.debt_asset_count}
                collateralAssetCount={a.collateral_asset_count}
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
          <p className="text-dust text-sm">No agreements found</p>
          <p className="text-ash text-xs mt-1">Try a different filter or create a new agreement</p>
        </div>
      )}
    </div>
  )
}
