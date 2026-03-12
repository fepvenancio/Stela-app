'use client'

import { use, useState, useMemo, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import Link from 'next/link'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { usePairListings } from '@/hooks/usePairListings'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { SelectionActionBar } from '@/components/SelectionActionBar'
import { LendReviewModal } from '@/components/LendReviewModal'
import { TokenAvatar, stringToColor } from '@/components/TokenAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { enrichStatus } from '@/lib/status'
import { formatAddress, addressesEqual } from '@/lib/address'
import { computeYieldPercent } from '@/lib/filter-utils'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { BatchSelectionProvider, useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign } from '@/hooks/useBatchSign'
import { useInstantSettle, type MatchedOrder } from '@/hooks/useInstantSettle'
import { toast } from 'sonner'
import type { AssetRow } from '@/types/api'

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

function PairDetailContent({ debtToken, collateralToken }: { debtToken: string; collateralToken: string }) {
  const { address } = useAccount()
  const { inscriptions, orders, isLoading, error } = usePairListings(debtToken, collateralToken)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const { toggle, isSelected, count, selected } = useBatchSelection()
  const { batchSign, isPending: isBatchSignPending } = useBatchSign()
  const { settle: instantSettle, isPending: isInstantSettlePending } = useInstantSettle()
  const isActionPending = isBatchSignPending || isInstantSettlePending

  const debtTokenInfo = findTokenByAddress(debtToken)
  const collTokenInfo = findTokenByAddress(collateralToken)
  const debtSymbol = debtTokenInfo?.symbol ?? formatAddress(debtToken)
  const collSymbol = collTokenInfo?.symbol ?? formatAddress(collateralToken)

  // Enrich inscription statuses
  const enrichedInscriptions = useMemo(() =>
    inscriptions.map((row) => ({
      ...row,
      status: enrichStatus(row),
    })),
    [inscriptions],
  )

  // Split into borrowers (seeking lenders) and active (filled)
  const borrowerListings = useMemo(
    () => enrichedInscriptions.filter((i) => i.status === 'open' || i.status === 'partial'),
    [enrichedInscriptions],
  )
  const activeListings = useMemo(
    () => enrichedInscriptions.filter((i) => i.status === 'filled'),
    [enrichedInscriptions],
  )

  // Compute stats
  const stats = useMemo(() => {
    const totalActive = borrowerListings.length + orders.length
    const totalFilled = activeListings.length

    // Best yield from inscriptions
    let bestYield: number | null = null
    for (const insc of borrowerListings) {
      const debtAssets = (insc.assets ?? []).filter((a: AssetRow) => a.asset_role === 'debt')
      const interestAssets = (insc.assets ?? []).filter((a: AssetRow) => a.asset_role === 'interest')
      const y = computeYieldPercent(debtAssets, interestAssets)
      if (y !== null && (bestYield === null || y > bestYield)) bestYield = y
    }

    // Also check orders
    for (const order of orders) {
      const raw: RawOrderData = typeof order.order_data === 'string'
        ? (() => { try { return JSON.parse(order.order_data as string) } catch { return {} } })()
        : (order.order_data as unknown as RawOrderData) ?? {}
      const d = normalizeOrderData(raw)
      const y = computeYieldPercent(d.debtAssets, d.interestAssets)
      if (y !== null && (bestYield === null || y > bestYield)) bestYield = y
    }

    return { totalActive, totalFilled, bestYield }
  }, [borrowerListings, activeListings, orders])

  /* ── Action Handlers ─────────────────────────────────── */

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

  return (
    <div className="animate-fade-up pb-24">
      {/* Back link + Header */}
      <div className="mb-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-xs text-dust hover:text-chalk transition-colors mb-4"
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
            <h1 className="text-lg font-semibold text-chalk">
              {debtSymbol} / {collSymbol}
            </h1>
            <p className="text-xs text-dust">P2P Lending Market</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 sm:gap-6 mt-4 p-3 rounded-xl bg-surface/20 border border-edge/30">
          <div>
            <p className="text-xs text-chalk font-medium">{stats.totalActive}</p>
            <p className="text-[9px] text-ash uppercase tracking-wider">Open</p>
          </div>
          <div className="w-px h-6 bg-edge/30" />
          <div>
            <p className="text-xs text-chalk font-medium">{stats.totalFilled}</p>
            <p className="text-[9px] text-ash uppercase tracking-wider">Active</p>
          </div>
          <div className="w-px h-6 bg-edge/30" />
          <div>
            <p className={`text-xs font-medium ${stats.bestYield !== null ? 'text-aurora' : 'text-dust'}`}>
              {stats.bestYield !== null ? `${stats.bestYield.toFixed(1)}%` : '--'}
            </p>
            <p className="text-[9px] text-ash uppercase tracking-wider">Best Yield</p>
          </div>
        </div>
      </div>

      {/* Selection Action Bar */}
      <SelectionActionBar onReview={() => setReviewOpen(true)} />

      {/* Loading */}
      {isLoading && (
        <div className="space-y-px rounded-xl border border-edge/30 overflow-clip" role="status" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full bg-surface/10" />
          ))}
          <span className="sr-only">Loading order book...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load pair data</p>
        </div>
      )}

      {/* Order Book: Borrowers seeking lenders */}
      {!isLoading && !error && (
        <>
          {/* Open on-chain inscriptions + off-chain orders */}
          {(borrowerListings.length > 0 || orders.length > 0) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-chalk uppercase tracking-wider">
                  Open Orders
                </h2>
                <Badge variant="open" className="h-[18px] text-[9px] px-1.5 py-0 font-bold">
                  {borrowerListings.length + orders.length}
                </Badge>
              </div>
              <div className="rounded-xl border border-edge/30 overflow-clip">
                <ListingTableHeader />
                <div className="flex flex-col">
                  {borrowerListings.map((a) => {
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
                  {orders.map((order) => {
                    const canFill = order.status === 'pending' && !!address && !addressesEqual(address, order.borrower)
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
            </div>
          )}

          {/* Active (filled) inscriptions */}
          {activeListings.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-chalk uppercase tracking-wider">
                  Active Loans
                </h2>
                <Badge variant="filled" className="h-[18px] text-[9px] px-1.5 py-0 font-bold">
                  {activeListings.length}
                </Badge>
              </div>
              <div className="rounded-xl border border-edge/30 overflow-clip">
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

          {/* Empty state */}
          {borrowerListings.length === 0 && orders.length === 0 && activeListings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
                  <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
                </svg>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-chalk text-sm font-medium">No active listings for this pair</p>
                <p className="text-dust text-xs">Be the first to create an inscription</p>
              </div>
              <Link
                href="/trade"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
                Trade
              </Link>
            </div>
          )}
        </>
      )}

      {/* Lend Review Modal */}
      <LendReviewModal open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  )
}

export default function PairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = use(params)

  // Parse "debtToken-collateralToken" — same logic as API route
  const separatorIdx = pair.indexOf('-0x', 2)
  if (separatorIdx === -1) {
    return (
      <div className="text-center py-24">
        <p className="text-nova text-sm">Invalid pair format</p>
        <Link href="/markets" className="text-xs text-dust hover:text-chalk mt-2 inline-block">
          Back to Markets
        </Link>
      </div>
    )
  }

  const debtToken = pair.slice(0, separatorIdx)
  const collateralToken = pair.slice(separatorIdx + 1)

  return (
    <BatchSelectionProvider>
      <PairDetailContent debtToken={debtToken} collateralToken={collateralToken} />
    </BatchSelectionProvider>
  )
}
