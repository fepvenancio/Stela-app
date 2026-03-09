'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import Link from 'next/link'

const TOGGLE_STYLE = "px-4 py-2 rounded-xl text-sm data-[state=on]:bg-star/15 data-[state=on]:text-star data-[state=on]:border-star/30 text-dust border border-transparent hover:text-chalk hover:bg-surface/50"

const STATUS_FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'filled', label: 'Filled' },
  { key: 'expired', label: 'Expired' },
  { key: 'all', label: 'All' },
]

interface FilterSectionProps {
  statusFilter: string
  setStatusFilter: (v: string) => void
  typeFilter: 'all' | 'swap' | 'lend'
  setTypeFilter: (v: 'all' | 'swap' | 'lend') => void
}

export function FilterSection({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
}: FilterSectionProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-4">
        <ToggleGroup
          type="single"
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
          className="flex flex-wrap gap-2"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map(({ key, label }) => (
            <ToggleGroupItem key={key} value={key} className={TOGGLE_STYLE}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(v) => v && setTypeFilter(v as typeof typeFilter)}
          className="flex gap-2"
          aria-label="Filter by type"
        >
          <ToggleGroupItem value="all" className={TOGGLE_STYLE}>All</ToggleGroupItem>
          <ToggleGroupItem value="swap" className={TOGGLE_STYLE}>Swap</ToggleGroupItem>
          <ToggleGroupItem value="lend" className={TOGGLE_STYLE}>Lend</ToggleGroupItem>
        </ToggleGroup>

      </div>

      <Link
        href="/trade?mode=lend"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-chalk border border-star/30 bg-star/5 hover:bg-star/10 hover:border-star/50 transition-colors shrink-0"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star"><path d="M6 2v8M2 6h8" /></svg>
        Borrow
      </Link>
    </div>
  )
}
