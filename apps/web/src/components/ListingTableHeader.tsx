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
      className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
        align === 'right' ? 'justify-end' : ''
      } ${active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
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
  const cellClass = 'text-xs text-gray-500'

  return (
    <div className="hidden md:grid grid-cols-[1fr_56px_64px_80px_72px_110px] gap-5 px-5 py-3 border-b border-border/20">
      <span className={cellClass}>Pool</span>
      <span className={`${cellClass} text-center`}>Type</span>
      {hasSort ? (
        <SortButton label="Yield" sortKey="apy" currentSort={sortBy} onSort={onSortChange} align="right" />
      ) : (
        <span className={`${cellClass} text-right`}>Yield</span>
      )}
      {hasSort ? (
        <SortButton label="Duration" sortKey="duration" currentSort={sortBy} onSort={onSortChange} align="right" />
      ) : (
        <span className={`${cellClass} text-right`}>Duration</span>
      )}
      <span className={`${cellClass} text-center`}>Status</span>
      <span className={`${cellClass} text-right`} />
    </div>
  )
}
