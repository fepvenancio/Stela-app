'use client'

import { useState, useMemo } from 'react'
import { useAccount } from '@starknet-react/core'
import { useInscriptions } from '@/hooks/useInscriptions'
import { useOrders } from '@/hooks/useOrders'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { BrowseControls, type SortOption } from '@/components/BrowseControls'
import { SelectionActionBar } from '@/components/SelectionActionBar'
import { LendReviewModal } from '@/components/LendReviewModal'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { enrichStatus } from '@/lib/status'
import { addressesEqual } from '@/lib/address'
import { BatchSelectionProvider, useBatchSelection } from '@/hooks/useBatchSelection'
import { toast } from 'sonner'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { Skeleton } from '@/components/ui/skeleton'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'filled', label: 'Filled' },
  { key: 'expired', label: 'Expired' },
  { key: 'all', label: 'All' },
]

const MAX_SELECTIONS = 10

function BrowseContent() {
  const [statusFilter, setStatusFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [reviewOpen, setReviewOpen] = useState(false)

  const { address } = useAccount()
  const { toggle, isSelected, count } = useBatchSelection()

  const { data: rawData, isLoading, error } = useInscriptions({ status: statusFilter })
  const { data: orders, isLoading: ordersLoading } = useOrders({ status: 'all' })

  // Enrich, Filter, and Sort
  const data = useMemo(() => {
    let results = rawData.map((row) => ({
      ...row,
      status: enrichStatus(row),
    }))

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter((item) => {
        if (item.id.toLowerCase().includes(q)) return true
        if (item.creator.toLowerCase().includes(q)) return true
        return item.assets?.some((a) => {
          const token = findTokenByAddress(a.asset_address)
          return (
            token?.symbol.toLowerCase().includes(q) ||
            token?.name.toLowerCase().includes(q) ||
            a.asset_address.toLowerCase().includes(q)
          )
        })
      })
    }

    // Sort
    results.sort((a, b) => {
      if (sortBy === 'newest') return Number(b.created_at_ts) - Number(a.created_at_ts)
      if (sortBy === 'duration') return Number(b.duration) - Number(a.duration)
      if (sortBy === 'debt_desc' || sortBy === 'debt_asc') {
        const valA = a.assets?.filter(as => as.asset_role === 'debt').reduce((acc, as) => acc + BigInt(as.value || '0'), 0n) ?? 0n
        const valB = b.assets?.filter(as => as.asset_role === 'debt').reduce((acc, as) => acc + BigInt(as.value || '0'), 0n) ?? 0n
        return sortBy === 'debt_desc' ? (valA < valB ? 1 : -1) : (valA > valB ? 1 : -1)
      }
      if (sortBy === 'apy') {
        const getRatio = (item: typeof results[number]) => {
          const debt = item.assets?.filter(as => as.asset_role === 'debt').reduce((acc, as) => acc + BigInt(as.value || '0'), 0n) ?? 1n
          const interest = item.assets?.filter(as => as.asset_role === 'interest').reduce((acc, as) => acc + BigInt(as.value || '0'), 0n) ?? 0n
          return Number(interest) / Number(debt === 0n ? 1n : debt)
        }
        return getRatio(b) - getRatio(a)
      }
      return 0
    })

    return results
  }, [rawData, search, sortBy])

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          The <span className="text-star">Stela</span> Library
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          Explore active lending inscriptions on StarkNet. Sign as a lender to earn interest, or inscribe your own.
        </p>
      </div>

      {/* Filters & Controls */}
      <div className="space-y-6 mb-8">
        <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} className="flex flex-wrap gap-2" aria-label="Filter by status">
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

        <BrowseControls
          search={search}
          onSearchChange={setSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Selection Action Bar */}
      <SelectionActionBar onReview={() => setReviewOpen(true)} />

      {/* Table Header (hidden on mobile) */}
      {!isLoading && !error && data.length > 0 && (
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
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading inscriptions">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-surface/20 rounded-xl" />
          ))}
          <span className="sr-only">Loading inscriptions...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load inscriptions</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && data.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.map((a, i) => {
            const enrichedStatus = a.status
            const isOwn = address && a.creator && addressesEqual(address, a.creator)
            const canSelect = enrichedStatus === 'open' && !a.multi_lender && !isOwn

            return (
              <div key={a.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-up">
                <InscriptionListRow
                  id={a.id}
                  status={enrichedStatus}
                  creator={a.creator}
                  multiLender={a.multi_lender}
                  duration={a.duration}
                  assets={a.assets ?? []}
                  selectable={canSelect}
                  selected={canSelect && isSelected(a.id)}
                  onSelect={canSelect ? () => {
                    if (!isSelected(a.id) && count >= MAX_SELECTIONS) {
                      toast.warning(`Maximum ${MAX_SELECTIONS} inscriptions per batch`)
                      return
                    }
                    toggle({ id: a.id, assets: a.assets ?? [], multiLender: a.multi_lender })
                  } : undefined}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Off-chain Orders Section */}
      {!ordersLoading && orders.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold whitespace-nowrap">Off-chain Orders (Pending Settlement)</span>
            <div className="h-px w-full bg-edge/20" />
          </div>
          <div className="flex flex-col gap-3">
            {orders.map((order, i) => (
              <div key={order.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-up">
                <OrderListRow order={order} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && data.length === 0 && orders.length === 0 && (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-edge mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
              <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
            </svg>
          </div>
          <p className="text-dust text-sm">No inscriptions found</p>
          <p className="text-ash text-xs mt-1">Try a different filter or search query</p>
        </div>
      )}

      {/* Lend Review Modal */}
      <LendReviewModal open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  )
}

export default function BrowsePage() {
  return (
    <BatchSelectionProvider>
      <BrowseContent />
    </BatchSelectionProvider>
  )
}
