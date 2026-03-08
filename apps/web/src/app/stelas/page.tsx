'use client'

import { useState, useMemo, useDeferredValue, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { useInscriptions } from '@/hooks/useInscriptions'
import { useOrders } from '@/hooks/useOrders'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { BrowseControls, type SortOption } from '@/components/BrowseControls'
import { SelectionActionBar } from '@/components/SelectionActionBar'
import { LendReviewModal } from '@/components/LendReviewModal'
import { FilterSection } from './components/FilterSection'
import { enrichStatus, mapInscriptionFilterToOrderFilter } from '@/lib/status'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import type { AssetRow } from '@/types/api'
import { addressesEqual } from '@/lib/address'
import { BatchSelectionProvider, useBatchSelection } from '@/hooks/useBatchSelection'
import { toast } from 'sonner'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { useBatchSign } from '@/hooks/useBatchSign'
import { useInstantSettle, type MatchedOrder } from '@/hooks/useInstantSettle'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EMPTY_FILTERS,
  passesAdvancedFilters,
  computeDebtDistance,
  computeYieldPercent,
  computeCollateralValue,
  type FilterValues,
} from '@/lib/filter-utils'

const MAX_SELECTIONS = 10

/** Convert normalized order data into AssetRow[] for the selection system */
function orderDataToAssetRows(orderId: string, raw: RawOrderData): AssetRow[] {
  const d = normalizeOrderData(raw)
  const rows: AssetRow[] = []
  const addRole = (assets: { asset_address: string; asset_type: string; value: string; token_id: string }[], role: 'debt' | 'interest' | 'collateral') => {
    assets.forEach((a, i) => rows.push({
      inscription_id: orderId,
      asset_role: role,
      asset_index: i,
      asset_address: a.asset_address,
      asset_type: a.asset_type,
      value: a.value || null,
      token_id: a.token_id || null,
    }))
  }
  addRole(d.debtAssets, 'debt')
  addRole(d.interestAssets, 'interest')
  addRole(d.collateralAssets, 'collateral')
  return rows
}

function BrowseContent() {
  const [statusFilter, setStatusFilter] = useState('open')
  const [typeFilter, setTypeFilter] = useState<'all' | 'swap' | 'lend'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'onchain' | 'offchain'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const deferredFilters = useDeferredValue(filters)

  const { address } = useAccount()
  const { toggle, isSelected, count, selected } = useBatchSelection()
  const { batchSign, isPending: isBatchSignPending } = useBatchSign()
  const { settle: instantSettle, isPending: isInstantSettlePending } = useInstantSettle()

  const { data: rawData, isLoading, error } = useInscriptions({ status: statusFilter })
  const orderStatusFilter = useMemo(() => mapInscriptionFilterToOrderFilter(statusFilter), [statusFilter])
  // When comma-separated, fetch all and filter client-side; 'none' still fetches but gets filtered to []
  const orderApiFetchStatus = orderStatusFilter.includes(',') ? 'all' : orderStatusFilter === 'none' ? 'all' : orderStatusFilter
  const { data: allOrders, isLoading: ordersLoading } = useOrders({ status: orderApiFetchStatus })

  // Client-side filter orders to match the active status filter
  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'none') return []
    let result = allOrders
    if (statusFilter !== 'all') {
      if (orderStatusFilter.includes(',')) {
        const allowed = new Set(orderStatusFilter.split(','))
        result = result.filter((o) => allowed.has(o.status))
      } else if (orderStatusFilter !== 'all') {
        result = result.filter((o) => o.status === orderStatusFilter)
      }
    }

    // Apply search to orders
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((o) => {
        if (o.id.toLowerCase().includes(q)) return true
        if (o.borrower.toLowerCase().includes(q)) return true
        const raw: RawOrderData = typeof o.order_data === 'string'
          ? (() => { try { return JSON.parse(o.order_data as string) } catch { return {} } })()
          : (o.order_data as unknown as RawOrderData) ?? {}
        const data = normalizeOrderData(raw)
        return [...data.debtAssets, ...data.interestAssets, ...data.collateralAssets].some((a) => {
          const token = findTokenByAddress(a.asset_address)
          return (
            token?.symbol.toLowerCase().includes(q) ||
            token?.name.toLowerCase().includes(q) ||
            a.asset_address.toLowerCase().includes(q)
          )
        })
      })
    }

    // Apply advanced filters to orders
    result = result.filter((o) => {
      const raw: RawOrderData = typeof o.order_data === 'string'
        ? (() => { try { return JSON.parse(o.order_data as string) } catch { return {} } })()
        : (o.order_data as unknown as RawOrderData) ?? {}
      const data = normalizeOrderData(raw)
      return passesAdvancedFilters(data.debtAssets, data.interestAssets, data.collateralAssets, deferredFilters)
    })

    // Type filter (swap vs lend)
    if (typeFilter !== 'all') {
      result = result.filter((o) => {
        const raw2: RawOrderData = typeof o.order_data === 'string'
          ? (() => { try { return JSON.parse(o.order_data as string) } catch { return {} } })()
          : (o.order_data as unknown as RawOrderData) ?? {}
        const d = normalizeOrderData(raw2)
        const dur = Number(d.duration)
        return typeFilter === 'swap' ? dur === 0 : dur > 0
      })
    }

    return result
  }, [allOrders, statusFilter, orderStatusFilter, search, deferredFilters, typeFilter])

  // Enrich, Filter, and Sort inscriptions
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

    // Advanced filters
    results = results.filter((item) => {
      const debtAssets = (item.assets ?? []).filter((a) => a.asset_role === 'debt')
      const interestAssets = (item.assets ?? []).filter((a) => a.asset_role === 'interest')
      const collateralAssets = (item.assets ?? []).filter((a) => a.asset_role === 'collateral')
      return passesAdvancedFilters(debtAssets, interestAssets, collateralAssets, deferredFilters)
    })

    // Type filter (swap vs lend)
    if (typeFilter !== 'all') {
      results = results.filter((item) => {
        const dur = Number(item.duration)
        return typeFilter === 'swap' ? dur === 0 : dur > 0
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
      if (sortBy === 'apy' || sortBy === 'interest_desc') {
        const yieldA = computeYieldPercent(
          (a.assets ?? []).filter(as => as.asset_role === 'debt'),
          (a.assets ?? []).filter(as => as.asset_role === 'interest'),
        ) ?? 0
        const yieldB = computeYieldPercent(
          (b.assets ?? []).filter(as => as.asset_role === 'debt'),
          (b.assets ?? []).filter(as => as.asset_role === 'interest'),
        ) ?? 0
        return yieldB - yieldA
      }
      if (sortBy === 'collateral_desc') {
        const valA = computeCollateralValue((a.assets ?? []).filter(as => as.asset_role === 'collateral'))
        const valB = computeCollateralValue((b.assets ?? []).filter(as => as.asset_role === 'collateral'))
        return valB - valA
      }
      return 0
    })

    // If a debt amount target is set, re-sort by closest match
    if (deferredFilters.debtAmount) {
      results.sort((a, b) => {
        const distA = computeDebtDistance(
          (a.assets ?? []).filter(as => as.asset_role === 'debt'),
          deferredFilters.debtAmount,
          deferredFilters.debtToken,
        )
        const distB = computeDebtDistance(
          (b.assets ?? []).filter(as => as.asset_role === 'debt'),
          deferredFilters.debtAmount,
          deferredFilters.debtToken,
        )
        return Number(distA - distB)
      })
    }

    return results
  }, [rawData, search, sortBy, deferredFilters, typeFilter])

  /* ── Action Handlers ─────────────────────────────────── */

  const handleOnchainAction = useCallback(async (inscriptionId: string, assets: { asset_address: string; value: string | null; asset_role: string }[]) => {
    if (!address) {
      toast.error('Connect your wallet to continue')
      return
    }
    setActionPendingId(inscriptionId)
    try {
      const debtAssets = assets
        .filter((a) => a.asset_role === 'debt')
        .map((a) => ({ address: a.asset_address, value: a.value ?? '0' }))
      await batchSign([{ inscriptionId, bps: 10000, debtAssets }])
    } catch {
      // Error already toasted in hook
    } finally {
      setActionPendingId(null)
    }
  }, [address, batchSign])

  const handleOffchainAction = useCallback(async (order: MatchedOrder) => {
    if (!address) {
      toast.error('Connect your wallet to continue')
      return
    }
    setActionPendingId(order.id)
    try {
      await instantSettle(order)
    } catch {
      // Error already toasted in hook
    } finally {
      setActionPendingId(null)
    }
  }, [address, instantSettle])

  const isActionPending = isBatchSignPending || isInstantSettlePending

  return (
    <div className="animate-fade-up pb-24">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          The Stela Library
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          Explore active lending inscriptions on StarkNet. Sign as a lender to earn interest, or inscribe your own.
        </p>
      </div>

      {/* Filters & Controls */}
      <div className="space-y-6 mb-8">
        <FilterSection
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
        />

        <BrowseControls
          search={search}
          onSearchChange={setSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((p) => !p)}
        />
      </div>

      {/* Selection Action Bar */}
      <SelectionActionBar onReview={() => setReviewOpen(true)} />

      {/* Table header rendered inside the content container below */}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading inscriptions">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl bg-surface/20" />
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

      {/* Content — unified table based on source filter */}
      {(() => {
        const showOnchain = sourceFilter !== 'offchain'
        const showOffchain = sourceFilter !== 'onchain'
        const onchainRows = showOnchain ? data : []
        const offchainRows = showOffchain ? filteredOrders : []
        const hasRows = onchainRows.length > 0 || offchainRows.length > 0
        const isEmpty = !isLoading && !error && !hasRows

        return (
          <>
            {!isLoading && !error && hasRows && (
              <div className="rounded-lg border border-edge/30 overflow-clip">
                <ListingTableHeader />
                <div className="flex flex-col">
                  {onchainRows.map((a) => {
                    const enrichedStatus = a.status
                    const isOwn = address && a.creator && addressesEqual(address, a.creator)
                    const canFill = enrichedStatus === 'open' && !isOwn && !!address
                    const canSelect = canFill && !a.multi_lender

                    return (
                      <InscriptionListRow
                        key={a.id}
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
                          toggle({ id: a.id, assets: a.assets ?? [], multiLender: a.multi_lender, source: 'onchain' })
                        } : undefined}
                        onAction={canFill ? () => handleOnchainAction(a.id, a.assets ?? []) : undefined}
                        actionPending={actionPendingId === a.id || (isActionPending && actionPendingId === a.id)}
                      />
                    )
                  })}
                  {offchainRows.map((order) => {
                    const canFill = order.status === 'pending' && !!address && !addressesEqual(address, order.borrower)
                    // Only allow selecting one off-chain order per borrower (nonce conflict)
                    const borrowerAlreadySelected = canFill && Array.from(selected.values()).some(
                      (s) => s.source === 'offchain' && s.orderData && addressesEqual(s.orderData.borrower, order.borrower)
                    )
                    const canSelect = canFill && !borrowerAlreadySelected
                    const orderRaw = typeof order.order_data === 'string'
                      ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
                      : (order.order_data as Record<string, unknown>) ?? {}
                    return (
                      <OrderListRow
                        key={order.id}
                        order={order}
                        selectable={canFill}
                        selected={canFill && isSelected(order.id)}
                        onSelect={canFill ? () => {
                          if (isSelected(order.id)) {
                            toggle({ id: order.id, assets: [], multiLender: false, source: 'offchain' })
                            return
                          }
                          if (!canSelect) {
                            toast.warning('Only one order per borrower can be selected', {
                              description: 'Selecting multiple orders from the same borrower would cause nonce conflicts.',
                            })
                            return
                          }
                          if (count >= MAX_SELECTIONS) {
                            toast.warning(`Maximum ${MAX_SELECTIONS} items per batch`)
                            return
                          }
                          toggle({
                            id: order.id,
                            assets: orderDataToAssetRows(order.id, orderRaw as RawOrderData),
                            multiLender: false,
                            source: 'offchain',
                            orderData: {
                              borrower: order.borrower,
                              borrower_signature: order.borrower_signature,
                              nonce: order.nonce,
                              deadline: order.deadline,
                              created_at: order.created_at,
                              order_data: orderRaw,
                            },
                          })
                        } : undefined}
                        onAction={canFill ? () => handleOffchainAction({
                          id: order.id,
                          borrower: order.borrower,
                          borrower_signature: order.borrower_signature,
                          nonce: order.nonce,
                          deadline: order.deadline,
                          created_at: order.created_at,
                          order_data: orderRaw,
                        }) : undefined}
                        actionPending={actionPendingId === order.id}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
                    <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
                  </svg>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-chalk text-sm font-medium">
                    {sourceFilter === 'onchain' ? 'No on-chain inscriptions found' :
                     sourceFilter === 'offchain' ? 'No off-chain orders found' :
                     'No inscriptions found'}
                  </p>
                  <p className="text-dust text-xs">Try a different filter or search query</p>
                </div>
                <Link href="/inscribe" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
                  Create Inscription
                </Link>
              </div>
            )}
          </>
        )
      })()}

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
