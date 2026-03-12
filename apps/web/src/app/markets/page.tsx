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
    </div>
  )
}
