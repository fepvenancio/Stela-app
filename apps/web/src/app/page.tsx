'use client'

import { useAgreements } from '@/hooks/useAgreements'
import { AgreementCard } from '@/components/AgreementCard'
import { WalletButton } from '@/components/WalletButton'
import { useState } from 'react'

export default function BrowsePage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const { data, isLoading, error } = useAgreements({ status: statusFilter })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Browse Agreements</h1>
        <WalletButton />
      </div>

      <div className="flex gap-2 mb-6">
        {['open', 'partial', 'filled', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === 'all' ? '' : s)}
            className={`px-3 py-1.5 rounded text-sm ${
              (s === 'all' && !statusFilter) || statusFilter === s
                ? 'bg-blue-600'
                : 'bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-neutral-400">Loading agreements...</p>}
      {error && <p className="text-red-400">Failed to load agreements</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a) => (
          <AgreementCard
            key={a.id}
            id={a.id}
            status={a.status}
            creator={a.creator}
            multiLender={a.multi_lender}
            duration={a.duration}
            debtAssetCount={a.debt_asset_count}
            collateralAssetCount={a.collateral_asset_count}
          />
        ))}
      </div>

      {!isLoading && data.length === 0 && (
        <p className="text-neutral-500 text-center py-12">No agreements found</p>
      )}
    </div>
  )
}
