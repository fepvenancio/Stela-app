'use client'

import { use, useState, useMemo, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import Link from 'next/link'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { usePairListings } from '@/hooks/usePairListings'
import { useOrderBook } from '@/hooks/useOrderBook'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { LoadMore } from '@/components/LoadMore'
import { SelectionActionBar } from '@/components/SelectionActionBar'
import { LendReviewModal } from '@/components/LendReviewModal'
import { TokenAvatar, stringToColor } from '@/components/TokenAvatar'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/orderbook/ModeToggle'
import { DurationFilter } from '@/components/orderbook/DurationFilter'
import { SplitBook, type RowClickInfo } from '@/components/orderbook/SplitBook'
import { ActionWidget } from '@/components/orderbook/ActionWidget'
import { enrichStatus } from '@/lib/status'
import { formatAddress, addressesEqual } from '@/lib/address'
import { computeYieldPercent } from '@/lib/filter-utils'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign } from '@/hooks/useBatchSign'
import { useInstantSettle, type MatchedOrder } from '@/hooks/useInstantSettle'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AssetRow } from '@/types/api'
import type { TokenDisplay, DurationFilter as DurationFilterType } from '@/types/orderbook'

const MAX_SELECTIONS = 10

function TokenIcon({ address, size = 32 }: { address: string; size?: number }) {
  const token = findTokenByAddress(address)
  if (token) return <TokenAvatar token={token} size={size} />
  const symbol = formatAddress(address)
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: stringToColor(symbol), fontSize: size * 0.35 }}
    >
      {symbol.charAt(0)}
    </div>
  )
}

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

/** Duration filter ranges (seconds) */
const DURATION_RANGE_MAP: Record<DurationFilterType, [number, number] | null> = {
  all: null,
  '7d': [0, 7 * 86400 + 1],
  '30d': [7 * 86400, 30 * 86400 + 1],
  '90d': [30 * 86400, 90 * 86400 + 1],
  '180d': [90 * 86400, 180 * 86400 + 1],
  '365d': [180 * 86400, 366 * 86400],
}

function PairDetailContent({ debtToken, collateralToken }: { debtToken: string; collateralToken: string }) {
  const { address } = useAccount()
  const { inscriptions, orders, isLoading, error, hasMore, isLoadingMore, loadMore, total, loaded } = usePairListings(debtToken, collateralToken)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const { toggle, isSelected, count, selected } = useBatchSelection()
  const { batchSign, isPending: isBatchSignPending } = useBatchSign()
  const { settle: instantSettle, isPending: isInstantSettlePending } = useInstantSettle()
  const isActionPending = isBatchSignPending || isInstantSettlePending

  // Track which side of the order book is active for the widget
  const [activeLendSide, setActiveLendSide] = useState<'left' | 'right'>('left')
  const [selectedBookOrder, setSelectedBookOrder] = useState<RowClickInfo | null>(null)
  const [activeWidgetTab, setActiveWidgetTab] = useState<'lend' | 'borrow' | 'swap'>('lend')

  // Mode & filter state
  const [mode, setMode] = useState<'lending' | 'swap'>('lending')
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>('all')

  // Expanded stelas list toggle
  const [showStelas, setShowStelas] = useState(false)

  const debtTokenInfo = findTokenByAddress(debtToken)
  const collTokenInfo = findTokenByAddress(collateralToken)
  const debtSymbol = debtTokenInfo?.symbol ?? formatAddress(debtToken)
  const collSymbol = collTokenInfo?.symbol ?? formatAddress(collateralToken)

  // Order book data — both pair directions for proper two-sided view
  const { data: orderBookData, isLoading: obLoading } = useOrderBook(debtToken, collateralToken, {
    duration: durationFilter,
    refreshInterval: 30_000,
  })
  const { data: reverseBookData, isLoading: obReverseLoading } = useOrderBook(collateralToken, debtToken, {
    duration: durationFilter,
    refreshInterval: 30_000,
  })

  // Build TokenDisplay objects for the ActionWidget
  const pairDisplay = useMemo<{ base: TokenDisplay; quote: TokenDisplay }>(() => ({
    base: {
      address: debtToken,
      symbol: debtSymbol,
      decimals: debtTokenInfo?.decimals ?? 18,
      logoUrl: debtTokenInfo?.logoUrl,
    },
    quote: {
      address: collateralToken,
      symbol: collSymbol,
      decimals: collTokenInfo?.decimals ?? 18,
      logoUrl: collTokenInfo?.logoUrl,
    },
  }), [debtToken, collateralToken, debtSymbol, collSymbol, debtTokenInfo, collTokenInfo])

  // Enrich inscription statuses
  const enrichedInscriptions = useMemo(() =>
    inscriptions.map((row) => ({
      ...row,
      status: enrichStatus(row),
    })),
    [inscriptions],
  )

  // Split into open (borrowers seeking lenders) and active (filled)
  const borrowerListings = useMemo(
    () => enrichedInscriptions.filter((i) => i.status === 'open' || i.status === 'partial'),
    [enrichedInscriptions],
  )
  const activeListings = useMemo(
    () => enrichedInscriptions.filter((i) => i.status === 'filled'),
    [enrichedInscriptions],
  )

  // Separate lending (duration > 0) from swaps (duration === 0)
  const lendingListings = useMemo(
    () => borrowerListings.filter((i) => {
      const dur = typeof i.duration === 'string' ? Number(i.duration) : Number(i.duration || 0)
      return dur > 0
    }),
    [borrowerListings],
  )
  const swapListings = useMemo(
    () => borrowerListings.filter((i) => {
      const dur = typeof i.duration === 'string' ? Number(i.duration) : Number(i.duration || 0)
      return dur === 0
    }),
    [borrowerListings],
  )

  // Parse order durations for orders
  const ordersWithDuration = useMemo(() => orders.map((order) => {
    const raw: RawOrderData = typeof order.order_data === 'string'
      ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
      : (order.order_data as unknown as RawOrderData) ?? {}
    const d = normalizeOrderData(raw)
    const duration = Number(d.duration) || 0
    return { order, raw, duration }
  }), [orders])

  const lendingOrders = useMemo(() => ordersWithDuration.filter((o) => o.duration > 0), [ordersWithDuration])
  const swapOrders = useMemo(() => ordersWithDuration.filter((o) => o.duration === 0), [ordersWithDuration])

  // Apply duration filter to lending listings
  const filteredLendingListings = useMemo(() => {
    const range = DURATION_RANGE_MAP[durationFilter]
    if (!range) return lendingListings
    const [min, max] = range
    return lendingListings.filter((i) => {
      const dur = typeof i.duration === 'string' ? Number(i.duration) : Number(i.duration || 0)
      return dur >= min && dur < max
    })
  }, [lendingListings, durationFilter])

  const filteredLendingOrders = useMemo(() => {
    const range = DURATION_RANGE_MAP[durationFilter]
    if (!range) return lendingOrders
    const [min, max] = range
    return lendingOrders.filter((o) => o.duration >= min && o.duration < max)
  }, [lendingOrders, durationFilter])

  // Available durations (for duration filter tabs)
  const availableDurations = useMemo(() => {
    const durations = new Set<number>()
    lendingListings.forEach((i) => {
      const dur = typeof i.duration === 'string' ? Number(i.duration) : Number(i.duration || 0)
      durations.add(dur)
    })
    lendingOrders.forEach((o) => durations.add(o.duration))
    return Array.from(durations).sort((a, b) => a - b)
  }, [lendingListings, lendingOrders])

  // Current visible listings based on mode
  const visibleListings = mode === 'lending' ? filteredLendingListings : swapListings
  const visibleOrders = mode === 'lending' ? filteredLendingOrders : swapOrders

  // Compute stats
  const stats = useMemo(() => {
    const totalLending = lendingListings.length + lendingOrders.length
    const totalSwaps = swapListings.length + swapOrders.length
    const totalActive = activeListings.length

    // Best yield from visible listings
    let bestYield: number | null = null
    const checkListings = mode === 'lending' ? filteredLendingListings : swapListings
    for (const insc of checkListings) {
      const debtAssets = (insc.assets ?? []).filter((a: AssetRow) => a.asset_role === 'debt')
      const interestAssets = (insc.assets ?? []).filter((a: AssetRow) => a.asset_role === 'interest')
      const y = computeYieldPercent(debtAssets, interestAssets)
      if (y !== null && (bestYield === null || y > bestYield)) bestYield = y
    }

    const checkOrders = mode === 'lending' ? filteredLendingOrders : swapOrders
    for (const { order, raw } of checkOrders) {
      const d = normalizeOrderData(raw)
      const y = computeYieldPercent(d.debtAssets, d.interestAssets)
      if (y !== null && (bestYield === null || y > bestYield)) bestYield = y
    }

    return { totalLending, totalSwaps, totalActive, bestYield }
  }, [
    lendingListings, lendingOrders, swapListings, swapOrders, activeListings,
    filteredLendingListings, filteredLendingOrders, mode,
  ])

  // Selected duration for ActionWidget (median of available, or null)
  const selectedDuration = useMemo(() => {
    if (mode === 'swap') return 0
    if (availableDurations.length === 0) return null
    const mid = Math.floor(availableDurations.length / 2)
    return availableDurations[mid] ?? null
  }, [mode, availableDurations])

  // Best order for ActionWidget quick-lend button
  const bestOrder = useMemo(() => {
    if (!orderBookData?.lending?.asks?.length) return null
    // First ask level has the best (highest) APR for lenders
    const bestLevel = orderBookData.lending.asks[0]
    if (!bestLevel?.orders?.length) return null
    const o = bestLevel.orders[0]
    return {
      id: o.id,
      source: o.source,
      apr: bestLevel.apr,
      amount: o.amount,
      duration: o.duration,
    }
  }, [orderBookData])

  // Best order from the reverse book (right side)
  const reverseBestOrder = useMemo(() => {
    if (!reverseBookData?.lending?.asks?.length) return null
    const bestLevel = reverseBookData.lending.asks[0]
    if (!bestLevel?.orders?.length) return null
    const o = bestLevel.orders[0]
    return {
      id: o.id,
      source: o.source,
      apr: bestLevel.apr,
      amount: o.amount,
      duration: o.duration,
    }
  }, [reverseBookData])

  // Dynamic pair & bestOrder based on which side is active
  const activePairDisplay = useMemo(() => {
    if (activeLendSide === 'right') {
      // Swap base/quote so widget shows quote token as the lend target
      return { base: pairDisplay.quote, quote: pairDisplay.base }
    }
    return pairDisplay
  }, [activeLendSide, pairDisplay])

  const activeBestOrder = useMemo(() => {
    // If user clicked a specific order, use it
    if (selectedBookOrder) {
      return {
        id: selectedBookOrder.id,
        source: selectedBookOrder.source,
        apr: selectedBookOrder.apr ?? 0,
        amount: selectedBookOrder.amount,
        duration: selectedBookOrder.duration ?? 0,
      }
    }
    // Otherwise use the best order from the active side
    return activeLendSide === 'right' ? reverseBestOrder : bestOrder
  }, [selectedBookOrder, activeLendSide, bestOrder, reverseBestOrder])

  const activeBestApr = useMemo(() => {
    if (selectedBookOrder?.apr != null) return selectedBookOrder.apr
    if (activeLendSide === 'right' && reverseBookData?.lending?.asks?.[0]) {
      return reverseBookData.lending.asks[0].apr
    }
    return stats.bestYield
  }, [selectedBookOrder, activeLendSide, reverseBookData, stats.bestYield])

  // Handle order book row click — switch widget to matching token
  const handleRowClick = useCallback((info: RowClickInfo) => {
    setActiveLendSide(info.side)
    setSelectedBookOrder(info)
    setActiveWidgetTab('lend')
  }, [])

  /* -- Action Handlers ------------------------------------ */

  const handleOnchainAction = useCallback(async (inscriptionId: string, assets: { asset_address: string; value: string | null; asset_role: string }[]) => {
    if (!address) {
      toast.error('Connect your wallet to continue')
      return
    }
    const debtAssets = assets
      .filter((a) => a.asset_role === 'debt')
      .map((a) => ({ address: a.asset_address, value: a.value ?? '0' }))
    if (debtAssets.length === 0) {
      toast.error('No debt asset data available', {
        description: 'The inscription may still be indexing. Please wait a moment and refresh.',
      })
      return
    }
    setActionPendingId(inscriptionId)
    try {
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

  // Quick lend: deep-link to Trade page with token and order context pre-filled
  const handleQuickLend = useCallback(async (orderId: string, _source: 'offchain' | 'onchain') => {
    window.location.href = `/trade?debtToken=${debtToken}&collateralToken=${collateralToken}&orderId=${orderId}`
  }, [debtToken, collateralToken])

  /* -- Render --------------------------------------------- */

  const stelaCount = visibleListings.length + visibleOrders.length

  return (
    <div className="animate-fade-up pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-4"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2L4 6l4 4" />
          </svg>
          Markets
        </Link>

        <div className="flex items-center gap-4">
          {/* Token pair avatars */}
          <div className="relative shrink-0 w-[52px] h-[32px]">
            <div className="absolute left-0 top-0 z-[1]">
              <TokenIcon address={debtToken} size={32} />
            </div>
            <div className="absolute left-[20px] top-0 ring-2 ring-void rounded-full">
              <TokenIcon address={collateralToken} size={32} />
            </div>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-white">
              {debtSymbol} / {collSymbol}
            </h1>
            <p className="text-xs text-gray-400">P2P Lending Market</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 sm:gap-6 mt-4 p-3 rounded-xl bg-surface/20 border border-border/30">
          <div>
            <p className={cn('text-xs font-medium font-mono tabular-nums', stats.bestYield !== null ? 'text-aurora' : 'text-gray-400')}>
              {stats.bestYield !== null ? `${stats.bestYield.toFixed(1)}%` : '--'}
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">
              {mode === 'lending' ? 'Best APR' : 'Best Rate'}
            </p>
          </div>
          <div className="w-px h-6 bg-edge/30" />
          <div>
            <p className="text-xs text-white font-medium font-mono tabular-nums">
              {stelaCount}
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Orders</p>
          </div>
          <div className="w-px h-6 bg-edge/30" />
          <div>
            <p className="text-xs text-white font-medium font-mono tabular-nums">{stats.totalActive}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Active</p>
          </div>
        </div>
      </div>

      {/* Selection Action Bar */}
      <SelectionActionBar onReview={() => setReviewOpen(true)} />

      {/* Mode toggle + Duration filter */}
      <div className="flex flex-col gap-3 mb-4">
        <ModeToggle
          value={mode}
          onChange={setMode}
          lendingCount={stats.totalLending}
          swapCount={stats.totalSwaps}
        />
        {mode === 'lending' && (
          <DurationFilter
            value={durationFilter}
            onChange={setDurationFilter}
            available={availableDurations}
          />
        )}
      </div>

      {/* Two-column layout: Order Book + Action Widget */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: Split Order Book + Individual Stelas */}
        <div className="flex-1 min-w-0 lg:w-[60%]">
          {/* Split Order Book — two-sided with individual stelas */}
          <SplitBook
            pairData={orderBookData}
            reversePairData={reverseBookData}
            isLoading={(obLoading || obReverseLoading) && isLoading}
            mode={mode}
            onRowClick={handleRowClick}
            selectedId={selectedBookOrder?.id}
          />

          {/* Individual Stelas toggle */}
          {stelaCount > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowStelas(!showStelas)}
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border border-border/20 bg-surface/10 hover:bg-surface/20 transition-colors cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={cn('text-gray-400 transition-transform', showStelas && 'rotate-90')}
                >
                  <path d="M5 3l4 4-4 4" />
                </svg>
                <span className="text-xs font-medium text-white">
                  Individual Stelas
                </span>
                <Badge variant="open" className="h-[18px] text-[9px] px-1.5 py-0 font-bold">
                  {stelaCount}
                </Badge>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {showStelas ? 'Hide' : 'Show'} individual orders
                </span>
              </button>
            </div>
          )}

          {/* Individual Stelas list (collapsible) */}
          {showStelas && !isLoading && !error && (
            <>
              {stelaCount > 0 && (
                <div className="mt-2">
                  <div className="rounded-xl border border-border/30 overflow-clip">
                    <ListingTableHeader />
                    <div className="flex flex-col">
                      {visibleListings.map((a) => {
                        const isOwn = address && a.creator && addressesEqual(address, a.creator)
                        const canFill = a.status === 'open' && !isOwn && !!address
                        const canSelect = canFill && !a.multi_lender

                        return (
                          <InscriptionListRow
                            key={a.id}
                            id={a.id}
                            status={a.status}
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
                      {visibleOrders.map(({ order, raw }) => {
                        const canFill = order.status === 'pending' && !!address && !addressesEqual(address, order.borrower)
                        const borrowerAlreadySelected = canFill && Array.from(selected.values()).some(
                          (s) => s.source === 'offchain' && s.orderData && addressesEqual(s.orderData.borrower, order.borrower)
                        )
                        const canSelect = canFill && !borrowerAlreadySelected

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
                                assets: orderDataToAssetRows(order.id, raw),
                                multiLender: false,
                                source: 'offchain',
                                orderData: {
                                  borrower: order.borrower,
                                  borrower_signature: order.borrower_signature,
                                  nonce: order.nonce,
                                  deadline: order.deadline,
                                  created_at: order.created_at,
                                  order_data: raw as unknown as Record<string, unknown>,
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
                              order_data: raw as unknown as Record<string, unknown>,
                            }) : undefined}
                            actionPending={actionPendingId === order.id}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Active (filled) inscriptions */}
              {activeListings.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Active Loans
                    </h2>
                    <Badge variant="filled" className="h-[18px] text-[9px] px-1.5 py-0 font-bold">
                      {activeListings.length}
                    </Badge>
                  </div>
                  <div className="rounded-xl border border-border/30 overflow-clip">
                    <ListingTableHeader />
                    <div className="flex flex-col">
                      {activeListings.map((a) => (
                        <InscriptionListRow
                          key={a.id}
                          id={a.id}
                          status={a.status}
                          creator={a.creator}
                          multiLender={a.multi_lender}
                          duration={a.duration}
                          assets={a.assets ?? []}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Load More */}
              {hasMore && (
                <div className="mt-4">
                  <LoadMore
                    hasMore={hasMore}
                    isLoading={isLoadingMore}
                    onLoadMore={loadMore}
                    total={total}
                    loaded={loaded}
                  />
                </div>
              )}
            </>
          )}

          {/* Loading state for individual listings */}
          {isLoading && (
            <div className="mt-4 space-y-px rounded-xl border border-border/30 overflow-clip" role="status" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[60px] w-full bg-surface/10 animate-pulse" />
              ))}
              <span className="sr-only">Loading orders...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 text-center py-12">
              <p className="text-nova text-sm">Failed to load pair data</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && stelaCount === 0 && activeListings.length === 0 && !orderBookData && (
            <div className="mt-6 flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" aria-hidden="true">
                  <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
                </svg>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-white text-sm font-medium">
                  No {mode === 'lending' ? 'lending' : 'swap'} orders for this pair
                </p>
                <p className="text-gray-400 text-xs">Be the first to create an order</p>
              </div>
              <Link
                href="/trade"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
                Trade
              </Link>
            </div>
          )}
        </div>

        {/* Right column: Action Widget (sticky on desktop) */}
        <div className="w-full lg:w-[40%] lg:max-w-[400px] shrink-0">
          <div className="lg:sticky lg:top-4">
            <ActionWidget
              pair={activePairDisplay}
              bestLendingApr={activeBestApr}
              bestSwapRate={null}
              mode={mode}
              selectedDuration={selectedDuration}
              bestOrder={activeBestOrder}
              onLend={handleQuickLend}
              isLending={false}
              activeTab={activeWidgetTab}
              onTabChange={setActiveWidgetTab}
            />
          </div>
        </div>
      </div>

      {/* Lend Review Modal */}
      <LendReviewModal open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  )
}

export default function PairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = use(params)

  // Parse "debtToken-collateralToken" -- same logic as API route
  const separatorIdx = pair.indexOf('-0x', 2)
  if (separatorIdx === -1) {
    return (
      <div className="text-center py-24">
        <p className="text-nova text-sm">Invalid pair format</p>
        <Link href="/markets" className="text-xs text-gray-400 hover:text-white mt-2 inline-block">
          Back to Markets
        </Link>
      </div>
    )
  }

  const debtToken = pair.slice(0, separatorIdx)
  const collateralToken = pair.slice(separatorIdx + 1)

  return (
    <PairDetailContent debtToken={debtToken} collateralToken={collateralToken} />
  )
}
