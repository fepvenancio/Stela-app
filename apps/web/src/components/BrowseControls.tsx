'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Search, ArrowUpDown, SlidersHorizontal, X } from 'lucide-react'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { useMemo } from 'react'
import type { FilterValues } from '@/lib/filter-utils'
import { hasActiveFilters } from '@/lib/filter-utils'

export type SortOption = 'newest' | 'apy' | 'duration' | 'debt_asc' | 'debt_desc' | 'interest_desc' | 'collateral_desc'

interface BrowseControlsProps {
  search: string
  onSearchChange: (v: string) => void
  sortBy: SortOption
  onSortChange: (v: SortOption) => void
  filters: FilterValues
  onFiltersChange: (f: FilterValues) => void
  showFilters: boolean
  onToggleFilters: () => void
}

export function BrowseControls({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
}: BrowseControlsProps) {
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])
  const filtersActive = hasActiveFilters(filters)

  const updateFilter = (key: keyof FilterValues, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({ search: '', debtToken: '', debtAmount: '', interestMin: '', collateralToken: '' })
  }

  return (
    <div className="space-y-3">
      {/* Top row: search + sort + filter toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
          <Input
            placeholder="Search by token, address, or ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-surface/40 border-border/50 focus:border-accent/50 transition-colors"
            aria-label="Search inscriptions"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`flex items-center gap-1.5 px-4 h-12 rounded-2xl border text-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none ${
              showFilters || filtersActive
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-surface/50 border-border text-gray-400 hover:text-white hover:bg-surface/60'
            }`}
            aria-label="Toggle advanced filters"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {filtersActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>

          <div className="flex items-center gap-2 bg-surface/50 border border-border rounded-2xl px-3 h-12">
            <ArrowUpDown className="w-4 h-4 text-gray-500 ml-1" aria-hidden="true" />
            <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
              <SelectTrigger className="border-0 bg-transparent focus:ring-0 w-[180px] text-sm text-gray-400 hover:text-white" aria-label="Sort inscriptions">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-border">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="apy">Highest APY</SelectItem>
                <SelectItem value="interest_desc">Best Interest</SelectItem>
                <SelectItem value="collateral_desc">Most Collateral</SelectItem>
                <SelectItem value="debt_desc">Largest Debt</SelectItem>
                <SelectItem value="debt_asc">Smallest Debt</SelectItem>
                <SelectItem value="duration">Longest Duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-surface/20 border border-border/30 animate-fade-up">
          {/* Debt Token */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              Debt Token
              <InfoTooltip content="Filter by the token being borrowed." side="bottom" />
            </label>
            <Select value={filters.debtToken} onValueChange={(v) => updateFilter('debtToken', v === '__all__' ? '' : v)}>
              <SelectTrigger className="bg-surface/40 border-border/50 text-sm h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-border">
                <SelectItem value="__all__">Any</SelectItem>
                {tokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Debt Amount */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              Debt Amount
              <InfoTooltip content="Find exact or closest match to this amount." side="bottom" />
            </label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 100"
              value={filters.debtAmount}
              onChange={(e) => updateFilter('debtAmount', e.target.value)}
              className="bg-surface/40 border-border/50 text-sm h-9"
              aria-label="Target debt amount"
            />
          </div>

          {/* Min Interest % */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              Min Interest %
              <InfoTooltip content="Only show inscriptions with yield at or above this percentage." side="bottom" />
            </label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 5"
              value={filters.interestMin}
              onChange={(e) => updateFilter('interestMin', e.target.value)}
              className="bg-surface/40 border-border/50 text-sm h-9"
              aria-label="Minimum interest percentage"
            />
          </div>

          {/* Collateral Token */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              Collateral Token
              <InfoTooltip content="Filter by the collateral token securing the loan." side="bottom" />
            </label>
            <Select value={filters.collateralToken} onValueChange={(v) => updateFilter('collateralToken', v === '__all__' ? '' : v)}>
              <SelectTrigger className="bg-surface/40 border-border/50 text-sm h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-border">
                <SelectItem value="__all__">Any</SelectItem>
                {tokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear */}
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 hover:text-white h-9">
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
