'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { usePairs } from '@/hooks/usePairs'
import { usePortfolio, type EnrichedInscription } from '@/hooks/usePortfolio'
import { PairCard } from '@/components/PairCard'
import { InscriptionListRow } from '@/components/InscriptionListRow'
import { OrderListRow } from '@/components/OrderListRow'
import { ListingTableHeader } from '@/components/ListingTableHeader'
import { LoadMore } from '@/components/LoadMore'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeAddress, formatAddress } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'
import { formatDurationHuman } from '@/lib/trade-constants'
import Link from 'next/link'

type SortOption = 'active' | 'volume' | 'total' | 'name'
type MarketTab = 'pairs' | 'nft'
type OwnerFilter = 'all' | 'owned'

/* ── Types for NFT Collections ───────────────────────────── */

interface CollectionOfferRow {
  id: string
  lender: string
  collection_address: string
  order_data: string
  status: string
  deadline: string
  debt_token: string | null
  created_at: string
}

interface CollectionOffersResponse {
  data: CollectionOfferRow[]
  meta: { page: number; limit: number; total: number }
}

interface CollectionMetadata {
  name: string
  symbol: string
  image: string
  totalSupply: number
  tokenType: string
}

interface NFTItem {
  tokenId: string
  name: string | null
  image: string | null
}

interface CollectionGroup {
  collectionAddress: string
  offers: CollectionOfferRow[]
  metadata: CollectionMetadata | null
  metadataLoading: boolean
  bestDebtAmount: string | null
  bestDebtSymbol: string | null
  bestInterestRate: string | null
}

/* ── Helpers ─────────────────────────────────────────────── */

interface ParsedOfferData {
  debtAssets?: Array<{ asset_address: string; value: string }>
  interestAssets?: Array<{ asset_address: string; value: string }>
  duration?: string
}

function parseOfferData(raw: string): ParsedOfferData {
  try {
    return JSON.parse(raw) as ParsedOfferData
  } catch {
    return {}
  }
}

/* ── Main Page ───────────────────────────────────────────── */

export default function StelasPage() {
  const [activeTab, setActiveTab] = useState<MarketTab>('pairs')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')

  return (
    <div className="animate-fade-up pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white mb-1">Stelas</h1>
        <p className="text-xs text-gray-400">
          Browse lending pairs and NFT collections. Toggle to Owned to see your positions.
        </p>
      </div>

      {/* Tab Switcher + Owner Toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1">
          {([
            { key: 'pairs' as const, label: 'Token Pairs' },
            { key: 'nft' as const, label: 'NFT Collections' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === key
                  ? 'bg-accent/10 text-accent border border-accent/25'
                  : 'text-gray-400 hover:text-white border border-border/40 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ALL / OWNED toggle */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-surface/20 border border-border/20">
          {(['all', 'owned'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setOwnerFilter(mode)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-all cursor-pointer ${
                ownerFilter === mode
                  ? 'bg-accent/15 text-accent border border-accent/25'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Token Pairs Tab */}
      {activeTab === 'pairs' && <TokenPairsSection ownerFilter={ownerFilter} />}

      {/* NFT Collections Tab */}
      {activeTab === 'nft' && <NFTCollectionsTab ownerFilter={ownerFilter} />}

      {/* FAQ Section */}
      <StelasInfoSection />
    </div>
  )
}

/* ── Token Pairs Section ─────────────────────────────────── */

function TokenPairsSection({ ownerFilter }: { ownerFilter: OwnerFilter }) {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : undefined
  const { data: pairs, isLoading, error } = usePairs()
  const portfolio = usePortfolio(ownerFilter === 'owned' ? normalized : undefined)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('active')

  const filtered = useMemo(() => {
    let result = [...pairs]

    // In OWNED mode: filter to pairs where user has inscriptions or orders
    if (ownerFilter === 'owned' && normalized) {
      const ownedPairKeys = new Set<string>()
      const allInscriptions = [...portfolio.lending, ...portfolio.borrowing, ...portfolio.repaid, ...portfolio.redeemable]
      for (const ins of allInscriptions) {
        const assets = ins.assets ?? []
        const debt = assets.find((a) => a.asset_role === 'debt')
        const coll = assets.find((a) => a.asset_role === 'collateral')
        if (debt && coll) {
          ownedPairKeys.add(`${normalizeAddress(debt.asset_address)}-${normalizeAddress(coll.asset_address)}`)
        }
      }
      result = result.filter((p) => {
        const key = `${normalizeAddress(p.debt_token)}-${normalizeAddress(p.collateral_token)}`
        return ownedPairKeys.has(key)
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => {
        const debtToken = findTokenByAddress(p.debt_token)
        const collToken = findTokenByAddress(p.collateral_token)
        const debtSymbol = debtToken?.symbol ?? formatAddress(p.debt_token)
        const collSymbol = collToken?.symbol ?? formatAddress(p.collateral_token)
        return (
          debtSymbol.toLowerCase().includes(q) ||
          collSymbol.toLowerCase().includes(q) ||
          p.debt_token.toLowerCase().includes(q) ||
          p.collateral_token.toLowerCase().includes(q)
        )
      })
    }

    result.sort((a, b) => {
      if (sortBy === 'active') return (b.open_count + b.pending_order_count) - (a.open_count + a.pending_order_count)
      if (sortBy === 'volume') return Number(b.total_volume) - Number(a.total_volume)
      if (sortBy === 'total') return b.total_count - a.total_count
      if (sortBy === 'name') {
        const nameA = (findTokenByAddress(a.debt_token)?.symbol ?? a.debt_token).toLowerCase()
        const nameB = (findTokenByAddress(b.debt_token)?.symbol ?? b.debt_token).toLowerCase()
        return nameA.localeCompare(nameB)
      }
      return 0
    })

    return result
  }, [pairs, search, sortBy, ownerFilter, normalized, portfolio.lending, portfolio.borrowing, portfolio.repaid, portfolio.redeemable])

  // In OWNED mode, also show positions list below pairs
  const showPositions = ownerFilter === 'owned' && normalized
  const allPositions = useMemo(() => {
    if (!showPositions) return []
    return [...portfolio.lending, ...portfolio.borrowing, ...portfolio.redeemable]
  }, [showPositions, portfolio.lending, portfolio.borrowing, portfolio.redeemable])

  if (ownerFilter === 'owned' && !address) {
    return (
      <Web3ActionWrapper message="to view your positions on StarkNet">
        <div />
      </Web3ActionWrapper>
    )
  }

  const loading = isLoading || (ownerFilter === 'owned' && portfolio.isLoading)

  return (
    <>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5">
        <Input
          placeholder="Search by token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface/30 border-border/40 text-sm h-9 sm:max-w-[240px]"
          aria-label="Search pairs"
        />
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="h-9 w-full sm:w-[150px] bg-surface/30 border-border/40 text-xs text-gray-400 hover:text-white rounded-lg" aria-label="Sort pairs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-[#050505] border-border">
            <SelectItem value="active">Most Active</SelectItem>
            <SelectItem value="volume">Highest Volume</SelectItem>
            <SelectItem value="total">Most Stelas</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading stelas">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full bg-surface/10 rounded-xl" />
          ))}
          <span className="sr-only">Loading stelas...</span>
        </div>
      )}

      {error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load stelas</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((pair) => (
            <PairCard key={`${pair.debt_token}-${pair.collateral_token}`} pair={pair} />
          ))}
        </div>
      )}

      {/* Owned positions */}
      {!loading && !error && showPositions && allPositions.length > 0 && (
        <div className="mt-6 rounded-xl border border-border/30 overflow-clip">
          <div className="flex items-center gap-3 px-4 py-2 bg-surface/20 border-b border-border/20">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Your Positions</span>
            <div className="flex-1 h-px bg-border/15" />
          </div>
          <ListingTableHeader />
          {allPositions.map((ins) => (
            <PositionRow key={ins.id} ins={ins} userAddress={normalized!} />
          ))}
          {portfolio.hasMoreInscriptions && (
            <LoadMore
              hasMore={portfolio.hasMoreInscriptions}
              isLoading={portfolio.isLoadingMoreInscriptions}
              onLoadMore={portfolio.loadMoreInscriptions}
              total={allPositions.length + (portfolio.hasMoreInscriptions ? 1 : 0)}
              loaded={allPositions.length}
            />
          )}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" aria-hidden="true">
              <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
            </svg>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-white text-sm font-medium">
              {ownerFilter === 'owned' ? 'No positions yet' : pairs.length === 0 ? 'No stelas yet' : 'No matching pairs'}
            </p>
            <p className="text-gray-400 text-xs">
              {ownerFilter === 'owned'
                ? 'Create an order on the trade page to start lending or borrowing.'
                : pairs.length === 0
                  ? 'Create the first inscription to open a stela'
                  : 'Try a different search term'}
            </p>
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
    </>
  )
}

/* ── Position Row with Action Button ─────────────────────── */

function PositionRow({ ins, userAddress }: { ins: EnrichedInscription & { shareBalance?: string }; userAddress: string }) {
  const isBorrower = ins.borrower ? normalizeAddress(ins.borrower) === userAddress : false
  const isLender = ins.lender ? normalizeAddress(ins.lender) === userAddress : false
  const hasShares = 'shareBalance' in ins && BigInt(ins.shareBalance ?? '0') > 0n

  // Determine action button
  let actionLabel: string | null = null
  let actionVariant: 'repay' | 'claim' | 'redeem' = 'repay'

  if ((ins.computedStatus === 'filled' || ins.computedStatus === 'grace_period') && isBorrower) {
    actionLabel = 'Repay'
    actionVariant = 'repay'
  } else if (ins.computedStatus === 'overdue' && isLender) {
    actionLabel = 'Liquidate'
    actionVariant = 'claim'
  } else if (ins.computedStatus === 'liquidated' && hasShares) {
    actionLabel = 'Redeem'
    actionVariant = 'redeem'
  } else if (ins.computedStatus === 'repaid' && hasShares) {
    actionLabel = 'Claim'
    actionVariant = 'claim'
  }

  const variantStyles = {
    repay: 'bg-green-500/10 text-aurora border-aurora/25 hover:bg-green-500/20 hover:border-aurora/40',
    claim: 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/20 hover:border-accent/40',
    redeem: 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/20 hover:border-accent/40',
  }

  return (
    <div className="relative group/pos">
      <InscriptionListRow
        id={ins.id}
        status={ins.computedStatus}
        creator={ins.creator}
        multiLender={ins.multi_lender}
        duration={ins.duration}
        assets={ins.assets ?? []}
        pendingShares={ins.pendingShares}
        signedAt={ins.signed_at ?? undefined}
      />
      {actionLabel && (
        <Link
          href={`/stela/${ins.id}`}
          className={`absolute right-4 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center h-7 px-3 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all border ${variantStyles[actionVariant]}`}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/* ── NFT Collections Tab ─────────────────────────────────── */

interface OwnedNFTGroup {
  collectionAddress: string
  collectionName: string
  collectionSymbol: string
  collectionImage: string | null
  nfts: NFTItem[]
}

function NFTCollectionsTab({ ownerFilter }: { ownerFilter: OwnerFilter }) {
  const { address } = useAccount()

  if (ownerFilter === 'owned') {
    return address ? <OwnedNFTsSection owner={address} /> : (
      <Web3ActionWrapper message="to view your NFTs on StarkNet">
        <div />
      </Web3ActionWrapper>
    )
  }

  return <AllCollectionsSection />
}

/* ── Owned NFTs Section ──────────────────────────────────── */

function OwnedNFTsSection({ owner }: { owner: string }) {
  const [groups, setGroups] = useState<OwnedNFTGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null)

  const fetchOwned = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/nft/owned/${encodeURIComponent(owner)}`)
      if (!res.ok) { setLoading(false); return }
      const json = (await res.json()) as { data: Array<{ tokenId: string; name: string | null; image: string | null; collection: string }> }
      const nfts = json.data ?? []

      // Group by collection
      const groupMap = new Map<string, Array<{ tokenId: string; name: string | null; image: string | null }>>()
      for (const nft of nfts) {
        const items = groupMap.get(nft.collection)
        if (items) items.push(nft)
        else groupMap.set(nft.collection, [nft])
      }

      // Build groups with metadata
      const initialGroups: OwnedNFTGroup[] = Array.from(groupMap.entries()).map(([addr, items]) => ({
        collectionAddress: addr,
        collectionName: '',
        collectionSymbol: '',
        collectionImage: null,
        nfts: items,
      }))

      setGroups(initialGroups)
      setLoading(false)

      // Fetch collection metadata in parallel
      const metaResults = await Promise.all(
        initialGroups.map(async (g) => {
          try {
            const res = await fetch(`/api/nft/collection/${encodeURIComponent(g.collectionAddress)}`)
            if (!res.ok) return null
            const json = (await res.json()) as { data: CollectionMetadata }
            return { address: g.collectionAddress, meta: json.data }
          } catch { return null }
        }),
      )

      setGroups((prev) => prev.map((g) => {
        const meta = metaResults.find((r) => r?.address === g.collectionAddress)?.meta
        const knownToken = findTokenByAddress(g.collectionAddress)
        return {
          ...g,
          collectionName: meta?.name || knownToken?.name || '',
          collectionSymbol: meta?.symbol || knownToken?.symbol || '',
          collectionImage: meta?.image || knownToken?.logoUrl || g.nfts[0]?.image || null,
        }
      }))
    } catch {
      setLoading(false)
    }
  }, [owner])

  useEffect(() => { fetchOwned() }, [fetchOwned])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="status" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full bg-surface/10 rounded-xl" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-400 text-sm">No NFTs found in your wallet</p>
        <Link href="/trade" className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors">
          Browse Trade
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.collectionAddress}
          className={`rounded-xl border transition-all ${
            expandedCollection === group.collectionAddress
              ? 'border-accent/30 bg-accent/5'
              : 'border-border/30 bg-surface/10 hover:bg-surface/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setExpandedCollection(expandedCollection === group.collectionAddress ? null : group.collectionAddress)}
            className="w-full flex items-center gap-4 p-4 text-left cursor-pointer"
          >
            {group.collectionImage ? (
              <img src={group.collectionImage} alt={group.collectionName} className="w-12 h-12 rounded-lg object-cover bg-surface shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/20 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white block truncate">
                {group.collectionName || formatAddress(group.collectionAddress)}
              </span>
              {group.collectionSymbol && <span className="text-[10px] text-gray-400 font-mono">{group.collectionSymbol}</span>}
              <p className="text-[10px] text-gray-500 mt-0.5">{group.nfts.length} owned</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedCollection === group.collectionAddress ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedCollection === group.collectionAddress && (
            <div className="px-4 pb-4 border-t border-border/15 pt-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {group.nfts.map((nft) => (
                  <CollectionNFTCard key={nft.tokenId} nft={nft} />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── All Collections Section (offers-based) ──────────────── */

function AllCollectionsSection() {
  const [groups, setGroups] = useState<CollectionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null)

  const fetchCollections = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/collection-offers?status=pending')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CollectionOffersResponse
      const offers = json.data ?? []

      // Group by collection_address
      const groupMap = new Map<string, CollectionOfferRow[]>()
      for (const offer of offers) {
        const existing = groupMap.get(offer.collection_address)
        if (existing) {
          existing.push(offer)
        } else {
          groupMap.set(offer.collection_address, [offer])
        }
      }

      // Build initial groups (metadata not yet loaded)
      const initialGroups: CollectionGroup[] = Array.from(groupMap.entries()).map(
        ([addr, collOffers]) => {
          // Find best terms
          let bestDebtAmount: string | null = null
          let bestDebtSymbol: string | null = null
          let bestInterestRate: string | null = null
          let bestDebtValue = 0n

          for (const o of collOffers) {
            const data = parseOfferData(o.order_data)
            const debtAsset = data.debtAssets?.[0]
            const intAsset = data.interestAssets?.[0]
            if (debtAsset?.value) {
              const v = BigInt(debtAsset.value)
              if (v > bestDebtValue) {
                bestDebtValue = v
                const token = findTokenByAddress(debtAsset.asset_address)
                bestDebtAmount = token
                  ? formatTokenValue(debtAsset.value, token.decimals)
                  : debtAsset.value
                bestDebtSymbol = token?.symbol ?? null
              }
            }
            if (intAsset?.value && debtAsset?.value) {
              const debtVal = Number(debtAsset.value)
              if (debtVal > 0) {
                const rate = (Number(intAsset.value) / debtVal) * 100
                const rateStr = rate.toFixed(2)
                if (bestInterestRate === null || rate < Number(bestInterestRate)) {
                  bestInterestRate = rateStr
                }
              }
            }
          }

          return {
            collectionAddress: addr,
            offers: collOffers,
            metadata: null,
            metadataLoading: true,
            bestDebtAmount,
            bestDebtSymbol,
            bestInterestRate,
          }
        },
      )

      setGroups(initialGroups)
      setLoading(false)

      // Fetch metadata in parallel
      const metadataPromises = initialGroups.map(async (group) => {
        try {
          const metaRes = await fetch(`/api/nft/collection/${encodeURIComponent(group.collectionAddress)}`)
          if (!metaRes.ok) return { address: group.collectionAddress, metadata: null }
          const json = (await metaRes.json()) as { data: CollectionMetadata }
          return { address: group.collectionAddress, metadata: json.data ?? null }
        } catch {
          return { address: group.collectionAddress, metadata: null }
        }
      })

      const results = await Promise.all(metadataPromises)

      setGroups((prev) =>
        prev.map((g) => {
          const result = results.find((r) => r.address === g.collectionAddress)
          return {
            ...g,
            metadata: result?.metadata ?? null,
            metadataLoading: false,
          }
        }),
      )
    } catch {
      setError('Failed to load collection offers')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  /* Loading */
  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading NFT collections">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[80px] w-full bg-surface/10 rounded-xl" />
        ))}
        <span className="sr-only">Loading NFT collections...</span>
      </div>
    )
  }

  /* Error */
  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-nova text-sm">{error}</p>
        <button
          type="button"
          onClick={fetchCollections}
          className="text-xs text-accent hover:text-accent-bright mt-2 cursor-pointer transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  /* Empty */
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-white text-sm font-medium">No NFT collection offers</p>
          <p className="text-gray-400 text-xs">Lenders can create collection offers on the trade page.</p>
        </div>
        <Link
          href="/trade"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white border border-accent/30 bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
          Create Offer
        </Link>
      </div>
    )
  }

  /* Collection Cards */
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <NFTCollectionCard
          key={group.collectionAddress}
          group={group}
          isExpanded={expandedCollection === group.collectionAddress}
          onToggle={() =>
            setExpandedCollection(
              expandedCollection === group.collectionAddress ? null : group.collectionAddress,
            )
          }
        />
      ))}
    </div>
  )
}

/* ── NFT Collection Card ─────────────────────────────────── */

function NFTCollectionCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: CollectionGroup
  isExpanded: boolean
  onToggle: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const [nfts, setNfts] = useState<NFTItem[]>([])
  const [nftsLoading, setNftsLoading] = useState(false)
  const [nftsFetched, setNftsFetched] = useState(false)

  const knownToken = findTokenByAddress(group.collectionAddress)
  const collectionName = group.metadata?.name || knownToken?.name || ''
  const collectionSymbol = group.metadata?.symbol || knownToken?.symbol || ''
  const collectionImage = group.metadata?.image || knownToken?.logoUrl || null
  const hasName = collectionName.length > 0

  // Fetch NFTs from collection when expanded
  useEffect(() => {
    if (!isExpanded || nftsFetched) return
    setNftsLoading(true)
    fetch(`/api/nft/contract/${encodeURIComponent(group.collectionAddress)}?limit=12`)
      .then((res) => (res.ok ? (res.json() as Promise<{ data: NFTItem[] }>) : null))
      .then((json) => {
        if (json?.data) setNfts(json.data)
        setNftsFetched(true)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setNftsLoading(false))
  }, [isExpanded, nftsFetched, group.collectionAddress])

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isExpanded
          ? 'border-accent/30 bg-accent/5'
          : 'border-border/30 bg-surface/10 hover:bg-surface/30 hover:border-border/50'
      }`}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left cursor-pointer"
      >
        {/* Collection image */}
        <div className="shrink-0">
          {collectionImage && !imgError ? (
            <img
              src={collectionImage}
              alt={collectionName}
              className="w-12 h-12 rounded-lg object-cover bg-surface"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-surface border border-border/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
          )}
        </div>

        {/* Collection info */}
        <div className="min-w-0 flex-1">
          {group.metadataLoading ? (
            <span className="inline-block w-24 h-3.5 bg-surface/20 rounded animate-pulse" />
          ) : (
            <>
              <span className="text-sm font-medium text-white block truncate">
                {hasName ? collectionName : formatAddress(group.collectionAddress)}
              </span>
              {collectionSymbol && (
                <span className="text-[10px] text-gray-400 font-mono">{collectionSymbol}</span>
              )}
              {!collectionSymbol && hasName && (
                <span className="text-[10px] text-gray-400 font-mono">{formatAddress(group.collectionAddress)}</span>
              )}
            </>
          )}
          <p className="text-[10px] text-gray-500 mt-0.5">
            {group.offers.length} active offer{group.offers.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Best terms */}
        <div className="hidden sm:flex items-center gap-6 text-right">
          {group.bestDebtAmount && (
            <div className="min-w-[80px]">
              <p className="text-xs text-white font-medium truncate">
                {group.bestDebtAmount} {group.bestDebtSymbol ?? ''}
              </p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Best Loan</p>
            </div>
          )}
          {group.bestInterestRate && (
            <div className="min-w-[60px]">
              <p className="text-xs text-aurora font-medium">{group.bestInterestRate}%</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Lowest Rate</p>
            </div>
          )}
        </div>

        {/* Arrow */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded: NFT grid + offer summary */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-border/15 pt-3">
            {/* NFT Grid */}
            {nftsLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-lg bg-surface/10" />
                ))}
              </div>
            ) : nfts.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
                {nfts.map((nft) => (
                  <CollectionNFTCard key={nft.tokenId} nft={nft} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3 mb-3">No NFTs found in this collection</p>
            )}

            {/* Offer summary */}
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Active Offers</span>
              {group.offers.map((offer) => {
                const data = parseOfferData(offer.order_data)
                const debtAsset = data.debtAssets?.[0]
                const debtToken = debtAsset ? findTokenByAddress(debtAsset.asset_address) : null
                const durationSec = data.duration ? Number(data.duration) : 0
                return (
                  <div key={offer.id} className="flex items-center justify-between py-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono">{formatAddress(offer.lender)}</span>
                      <span className="text-white">
                        {debtToken && debtAsset
                          ? `${formatTokenValue(debtAsset.value, debtToken.decimals)} ${debtToken.symbol}`
                          : '--'}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {durationSec > 0 ? formatDurationHuman(durationSec) : '--'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <Link
            href={`/trade?tab=lend&mode=collection&view=browse`}
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-bright transition-colors mt-3"
          >
            View all offers
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}

/* ── Collection NFT Card ─────────────────────────────────── */

function CollectionNFTCard({ nft }: { nft: NFTItem }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="rounded-lg border border-border/20 bg-surface/5 overflow-hidden">
      {nft.image && !imgError ? (
        <img
          src={nft.image}
          alt={nft.name || 'NFT'}
          className="aspect-square w-full object-cover bg-surface"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="aspect-square w-full bg-surface flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}
      <div className="px-1.5 py-1">
        {nft.name && (
          <p className="text-[10px] text-white truncate">{nft.name}</p>
        )}
      </div>
    </div>
  )
}

/* ── FAQ Section ──────────────────────────────────────────── */

const STELAS_FAQ = [
  {
    q: 'What are stelas?',
    a: 'Trading pairs showing active lending and swap activity on Stela. Each pair tracks open orders, volume, and settlement history.',
  },
  {
    q: 'What does volume mean?',
    a: 'Total value of settled orders for this pair. Only completed settlements count toward volume.',
  },
  {
    q: 'Can I create a new stela?',
    a: 'Stelas are auto-created when the first order for a pair is placed. No listing, no governance, no approval.',
  },
  {
    q: 'What pairs are available?',
    a: 'Any ERC20 pair on StarkNet. Fully permissionless. Paste the contract address to trade any token.',
  },
  {
    q: 'What are NFT collection offers?',
    a: 'Lenders post offers to lend against any NFT from a specific collection. Borrowers pick which NFT to use as collateral.',
  },
]

function StelasFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
      >
        <span className="text-sm text-white group-hover:text-accent transition-colors pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-gray-400 leading-relaxed pb-4 pr-8">{a}</p>
      )}
    </div>
  )
}

function StelasInfoSection() {
  return (
    <div className="mt-16 max-w-lg mx-auto">
      {/* Hero statement */}
      <section className="text-center mb-10">
        <p className="text-accent font-mono text-[10px] uppercase tracking-[0.3em] mb-3">
          Permissionless Markets
        </p>
        <h2 className="font-bold text-2xl sm:text-3xl tracking-tight text-white leading-[1.15] mb-4">
          Any pair, <span className="text-accent">no listing required.</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
          Stelas appear automatically when the first order is placed. Any ERC20 pair on StarkNet. No governance, no approval process.
        </p>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-12 py-6 border-t border-b border-border/15">
        <div className="text-center">
          <div className="font-bold text-xl text-white">Any ERC20</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Token Support</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-xl text-white">Auto</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Market Creation</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-xl text-white">0</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Listing Fee</div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-bold text-lg text-white uppercase tracking-wider mb-1">Questions?</h2>
        <p className="text-gray-400 text-sm mb-6">Answers.</p>
        <div>
          {STELAS_FAQ.map((item) => (
            <StelasFaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-400/60 uppercase tracking-widest">
        <span>Open Source</span>
        <span className="text-border/40">|</span>
        <span>Immutable</span>
        <span className="text-border/40">|</span>
        <span>StarkNet</span>
      </div>
    </div>
  )
}
