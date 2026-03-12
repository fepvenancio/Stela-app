'use client'

import { useState, useMemo } from 'react'
import { usePairs } from '@/hooks/usePairs'
import { PairCard } from '@/components/PairCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress } from '@/lib/address'
import Link from 'next/link'

type SortOption = 'active' | 'volume' | 'total' | 'name'

export default function MarketsPage() {
  const { data: pairs, isLoading, error } = usePairs()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('active')

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
          Browse lending pairs. Click a pair to view its order book.
        </p>
      </div>

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

      {/* ── FAQ Section ──────────────────────────────────────── */}
      <MarketsInfoSection />
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
