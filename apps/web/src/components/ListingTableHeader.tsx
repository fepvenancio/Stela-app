'use client'

export type SortOption = 'newest' | 'apy' | 'duration' | 'debt_asc' | 'debt_desc' | 'interest_desc' | 'collateral_desc'

interface ListingTableHeaderProps {
  sortBy?: SortOption
  onSortChange?: (s: SortOption) => void
}

function SortButton({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortOption
  currentSort: SortOption
  onSort: (s: SortOption) => void
  align?: 'left' | 'right'
}) {
  const active = currentSort === sortKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold transition-colors cursor-pointer ${
        align === 'right' ? 'justify-end' : ''
      } ${active ? 'text-star' : 'text-dust hover:text-chalk'}`}
    >
      {label}
      {active && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="shrink-0">
          <path d="M4 6L1 2h6L4 6z" />
        </svg>
      )}
    </button>
  )
}

export function ListingTableHeader({ sortBy, onSortChange }: ListingTableHeaderProps) {
  const hasSort = sortBy !== undefined && onSortChange !== undefined

  return (
    <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_72px_90px] gap-4 px-4 py-2 text-dust border-b border-edge/30 bg-surface/20">
      <span className="text-[10px] uppercase tracking-widest font-semibold">Pool</span>
      <span className="text-[10px] uppercase tracking-widest font-semibold text-center">Type</span>
      {hasSort ? (
        <SortButton label="Yield" sortKey="apy" currentSort={sortBy} onSort={onSortChange} align="right" />
      ) : (
        <span className="text-[10px] uppercase tracking-widest font-semibold text-right">Yield</span>
      )}
      {hasSort ? (
        <SortButton label="Duration" sortKey="duration" currentSort={sortBy} onSort={onSortChange} align="right" />
      ) : (
        <span className="text-[10px] uppercase tracking-widest font-semibold text-right">Duration</span>
      )}
      <span className="text-[10px] uppercase tracking-widest font-semibold text-center">Status</span>
      <span className="text-[10px] uppercase tracking-widest font-semibold text-right">Action</span>
    </div>
  )
}
