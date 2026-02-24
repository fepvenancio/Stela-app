'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ArrowUpDown } from 'lucide-react'

export type SortOption = 'newest' | 'apy' | 'duration' | 'debt_asc' | 'debt_desc'

interface BrowseControlsProps {
  search: string
  onSearchChange: (v: string) => void
  sortBy: SortOption
  onSortChange: (v: SortOption) => void
}

export function BrowseControls({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
}: BrowseControlsProps) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
        <Input
          placeholder="Search by token symbol or address..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-surface/40 border-edge/50 focus:border-star/50 transition-colors"
        />
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <div className="flex items-center gap-2 bg-surface/40 border border-edge/50 rounded-xl px-2">
          <ArrowUpDown className="w-4 h-4 text-ash ml-1" />
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="border-0 bg-transparent focus:ring-0 w-[160px] text-sm text-dust hover:text-chalk">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-void border-edge">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="apy">Highest APY</SelectItem>
              <SelectItem value="debt_desc">Largest Debt</SelectItem>
              <SelectItem value="debt_asc">Smallest Debt</SelectItem>
              <SelectItem value="duration">Longest Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
