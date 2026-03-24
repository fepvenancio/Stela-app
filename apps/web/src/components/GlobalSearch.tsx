'use client'

import { Search } from 'lucide-react'

export function GlobalSearch() {
  return (
    <div className="relative w-full max-w-xl group hidden lg:block">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-accent transition-colors" size={16} aria-hidden="true" />
      <input
        type="text"
        placeholder="Search markets, assets, inscriptions..."
        className="w-full bg-white/[0.02] border border-border rounded-xl py-2.5 pl-12 pr-4 text-xs focus:border-accent/40 focus:bg-white/[0.04] hover:border-accent/30 transition-all outline-none text-white placeholder:text-gray-700 focus-visible:ring-2 focus-visible:ring-accent/50"
        readOnly
        onFocus={(e) => e.target.blur()}
        title="Search coming soon"
      />
      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-white/[0.02] px-1.5 py-0.5 rounded border border-border hidden sm:inline">
        ⌘K
      </kbd>
    </div>
  )
}
