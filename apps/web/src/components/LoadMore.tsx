'use client'

interface LoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  total: number
  loaded: number
}

export function LoadMore({ hasMore, isLoading, onLoadMore, total, loaded }: LoadMoreProps) {
  if (total === 0) return null

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[10px] text-gray-400 font-mono">
        Showing {loaded} of {total}
      </span>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium text-gray-400 hover:text-white border border-border/30 hover:border-border/50 bg-surface/10 hover:bg-surface/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading && (
            <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Load More
        </button>
      )}
    </div>
  )
}
