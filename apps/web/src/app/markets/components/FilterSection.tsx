'use client'

import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import Link from 'next/link'
import { Search } from 'lucide-react'

const TAB_STYLE = "px-3 py-1.5 rounded-lg text-xs font-medium data-[state=on]:bg-star/15 data-[state=on]:text-star data-[state=on]:border-star/30 text-dust border border-transparent hover:text-chalk hover:bg-surface/50 transition-colors"

const STATUS_FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
]

interface FilterSectionProps {
  statusFilter: string
  setStatusFilter: (v: string) => void
  typeFilter: 'all' | 'swap' | 'lend'
  setTypeFilter: (v: 'all' | 'swap' | 'lend') => void
  search: string
  onSearchChange: (v: string) => void
  resultCount: number
}

export function FilterSection({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  search,
  onSearchChange,
  resultCount,
}: FilterSectionProps) {
  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg text-chalk tracking-wide">Markets</h1>
          <span className="text-xs text-dust tabular-nums">{resultCount} results</span>
        </div>
        <Link
          href="/trade?mode=lend"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-star"><path d="M6 2v8M2 6h8" /></svg>
          Create
        </Link>
      </div>

      {/* Search + filter tabs row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ash" aria-hidden="true" />
          <Input
            placeholder="Search tokens or addresses..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-surface/30 border-edge/40 focus:border-star/50 text-sm placeholder:text-ash/60 rounded-lg"
            aria-label="Search inscriptions"
          />
        </div>

        {/* Status tabs */}
        <ToggleGroup
          type="single"
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
          className="flex gap-1"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map(({ key, label }) => (
            <ToggleGroupItem key={key} value={key} className={TAB_STYLE}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-edge/30" />

        {/* Type tabs */}
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(v) => v && setTypeFilter(v as typeof typeFilter)}
          className="flex gap-1"
          aria-label="Filter by type"
        >
          <ToggleGroupItem value="all" className={TAB_STYLE}>All</ToggleGroupItem>
          <ToggleGroupItem value="swap" className={TAB_STYLE}>Swap</ToggleGroupItem>
          <ToggleGroupItem value="lend" className={TAB_STYLE}>Lend</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
