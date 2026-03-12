'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { usePairs } from '@/hooks/usePairs'
import { PairCard } from '@/components/PairCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'
import Link from 'next/link'

type SortOption = 'active' | 'volume' | 'total' | 'name'
type MarketTab = 'pairs' | 'nft'

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

function formatDurationHuman(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  const days = Math.round(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''}`
}

/* ── Main Page ───────────────────────────────────────────── */

export default function MarketsPage() {
  const { data: pairs, isLoading, error } = usePairs()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('active')
  const [activeTab, setActiveTab] = useState<MarketTab>('pairs')

  const filtered = useMemo(() => {
    let result = [...pairs]

    // Search by token symbol or address
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

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'active') {
        const activeA = a.open_count + a.pending_order_count
        const activeB = b.open_count + b.pending_order_count
        return activeB - activeA
      }
      if (sortBy === 'volume') {
        return Number(b.total_volume) - Number(a.total_volume)
      }
      if (sortBy === 'total') {
        return b.total_count - a.total_count
      }
      if (sortBy === 'name') {
        const nameA = (findTokenByAddress(a.debt_token)?.symbol ?? a.debt_token).toLowerCase()
        const nameB = (findTokenByAddress(b.debt_token)?.symbol ?? b.debt_token).toLowerCase()
        return nameA.localeCompare(nameB)
      }
      return 0
    })

    return result
  }, [pairs, search, sortBy])

  return (
    <div className="animate-fade-up pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-chalk mb-1">Markets</h1>
        <p className="text-xs text-dust">
          Browse lending pairs and NFT collection offers.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-5">
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
                ? 'bg-star/10 text-star border border-star/25'
                : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Token Pairs Tab */}
      {activeTab === 'pairs' && (
        <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5">
            <Input
              placeholder="Search by token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface/30 border-edge/40 text-sm h-9 sm:max-w-[240px]"
              aria-label="Search pairs"
            />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-9 w-full sm:w-[150px] bg-surface/30 border-edge/40 text-xs text-dust hover:text-chalk rounded-lg" aria-label="Sort pairs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-void border-edge">
                <SelectItem value="active">Most Active</SelectItem>
                <SelectItem value="volume">Highest Volume</SelectItem>
                <SelectItem value="total">Most Stelas</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading markets">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full bg-surface/10 rounded-xl" />
              ))}
              <span className="sr-only">Loading markets...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-24">
              <p className="text-nova text-sm">Failed to load markets</p>
            </div>
          )}

          {/* Pair Cards */}
          {!isLoading && !error && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((pair) => (
                <PairCard
                  key={`${pair.debt_token}-${pair.collateral_token}`}
                  pair={pair}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
                  <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74z" />
                </svg>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-chalk text-sm font-medium">
                  {pairs.length === 0 ? 'No markets yet' : 'No matching pairs'}
                </p>
                <p className="text-dust text-xs">
                  {pairs.length === 0
                    ? 'Create the first inscription to open a market'
                    : 'Try a different search term'}
                </p>
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

      {/* NFT Collections Tab */}
      {activeTab === 'nft' && <NFTCollectionsTab />}

      {/* FAQ Section */}
      <MarketsInfoSection />
    </div>
  )
}

/* ── NFT Collections Tab ─────────────────────────────────── */

function NFTCollectionsTab() {
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
          const meta = (await metaRes.json()) as CollectionMetadata
          return { address: group.collectionAddress, metadata: meta }
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

  // Listen for sync events
  useEffect(() => {
    const handler = () => fetchCollections()
    window.addEventListener('stela:sync', handler)
    return () => window.removeEventListener('stela:sync', handler)
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
          className="text-xs text-star hover:text-star-bright mt-2 cursor-pointer transition-colors"
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
        <div className="w-16 h-16 rounded-2xl bg-surface border border-edge flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-chalk text-sm font-medium">No NFT collection offers</p>
          <p className="text-dust text-xs">Lenders can create collection offers on the trade page.</p>
        </div>
        <Link
          href="/trade"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors"
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
  const collectionName =
    group.metadata?.name ??
    findTokenByAddress(group.collectionAddress)?.name ??
    formatAddress(group.collectionAddress)

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isExpanded
          ? 'border-aurora/30 bg-aurora/5'
          : 'border-edge/30 bg-surface/10 hover:bg-surface/30 hover:border-edge/50'
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
          {group.metadata?.image && !imgError ? (
            <img
              src={group.metadata.image}
              alt={collectionName}
              className="w-12 h-12 rounded-lg object-cover bg-abyss"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-abyss border border-edge/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash">
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
          <span className="text-sm font-medium text-chalk">
            {group.metadataLoading ? (
              <span className="inline-block w-24 h-3.5 bg-surface/20 rounded animate-pulse" />
            ) : (
              collectionName
            )}
          </span>
          <p className="text-[10px] text-ash mt-0.5">
            {group.offers.length} active offer{group.offers.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Best terms */}
        <div className="hidden sm:flex items-center gap-6 text-right">
          {group.bestDebtAmount && (
            <div className="min-w-[80px]">
              <p className="text-xs text-chalk font-medium truncate">
                {group.bestDebtAmount} {group.bestDebtSymbol ?? ''}
              </p>
              <p className="text-[9px] text-ash uppercase tracking-wider">Best Loan</p>
            </div>
          )}
          {group.bestInterestRate && (
            <div className="min-w-[60px]">
              <p className="text-xs text-aurora font-medium">{group.bestInterestRate}%</p>
              <p className="text-[9px] text-ash uppercase tracking-wider">Lowest Rate</p>
            </div>
          )}
        </div>

        {/* Arrow */}
        <svg
          className={`w-4 h-4 text-dust transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded: list of individual offers */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="border-t border-edge/15 pt-3">
            {group.offers.map((offer) => (
              <CollectionOfferInlineRow key={offer.id} offer={offer} />
            ))}
          </div>
          <Link
            href={`/trade?tab=lend&mode=collection&view=browse`}
            className="inline-flex items-center gap-1.5 text-xs text-star hover:text-star-bright transition-colors mt-1"
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

/* ── Inline Offer Row ────────────────────────────────────── */

function CollectionOfferInlineRow({ offer }: { offer: CollectionOfferRow }) {
  const data = parseOfferData(offer.order_data)
  const debtAsset = data.debtAssets?.[0]
  const intAsset = data.interestAssets?.[0]
  const debtToken = debtAsset ? findTokenByAddress(debtAsset.asset_address) : null
  const intToken = intAsset ? findTokenByAddress(intAsset.asset_address) : null
  const durationSec = data.duration ? Number(data.duration) : 0

  return (
    <div className="flex items-center justify-between py-2 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-dust font-mono">{formatAddress(offer.lender)}</span>
        <span className="text-edge">|</span>
        <span className="text-chalk">
          {debtToken && debtAsset
            ? `${formatTokenValue(debtAsset.value, debtToken.decimals)} ${debtToken.symbol}`
            : '--'}
        </span>
        {intToken && intAsset && (
          <>
            <span className="text-edge">+</span>
            <span className="text-aurora">
              {formatTokenValue(intAsset.value, intToken.decimals)} {intToken.symbol}
            </span>
          </>
        )}
      </div>
      <span className="text-dust shrink-0 ml-2">
        {durationSec > 0 ? formatDurationHuman(durationSec) : '--'}
      </span>
    </div>
  )
}

/* ── FAQ Section ──────────────────────────────────────────── */

const MARKETS_FAQ = [
  {
    q: 'What are markets?',
    a: 'Trading pairs showing active lending and swap activity on Stela. Each pair tracks open orders, volume, and settlement history.',
  },
  {
    q: 'What does volume mean?',
    a: 'Total value of settled orders for this pair. Only completed settlements count toward volume.',
  },
  {
    q: 'Can I create a new market?',
    a: 'Markets are auto-created when the first order for a pair is placed. No listing, no governance, no approval.',
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

function MarketsFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-edge/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
      >
        <span className="text-sm text-chalk group-hover:text-star transition-colors pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-dust shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-dust leading-relaxed pb-4 pr-8">{a}</p>
      )}
    </div>
  )
}

function MarketsInfoSection() {
  return (
    <div className="mt-16 max-w-lg mx-auto">
      {/* Hero statement */}
      <section className="text-center mb-10">
        <p className="text-star font-mono text-[10px] uppercase tracking-[0.3em] mb-3">
          Permissionless Markets
        </p>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-chalk leading-[1.15] mb-4">
          Any pair, <span className="text-star">no listing required.</span>
        </h2>
        <p className="text-dust text-sm leading-relaxed max-w-md mx-auto">
          Markets appear automatically when the first order is placed. Any ERC20 pair on StarkNet. No governance, no approval process.
        </p>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-10 mb-12 py-6 border-t border-b border-edge/15">
        <div className="text-center">
          <div className="font-display text-xl text-chalk">Any ERC20</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Token Support</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">Auto</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Market Creation</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-chalk">0</div>
          <div className="text-[10px] text-dust uppercase tracking-widest mt-0.5">Listing Fee</div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-display text-lg text-chalk uppercase tracking-wider mb-1">Questions?</h2>
        <p className="text-dust text-sm mb-6">Answers.</p>
        <div>
          {MARKETS_FAQ.map((item) => (
            <MarketsFaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-dust/60 uppercase tracking-widest">
        <span>Open Source</span>
        <span className="text-edge/40">|</span>
        <span>Immutable</span>
        <span className="text-edge/40">|</span>
        <span>StarkNet</span>
      </div>
    </div>
  )
}
