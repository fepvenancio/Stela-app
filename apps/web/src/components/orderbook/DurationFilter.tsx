'use client'

import { cn } from '@/lib/utils'
import type { DurationFilter as DurationFilterType } from '@/types/orderbook'

interface DurationFilterProps {
  value: DurationFilterType
  onChange: (v: DurationFilterType) => void
  available: number[]
}

const DURATION_TABS: { key: DurationFilterType; label: string; maxSeconds: number }[] = [
  { key: 'all', label: 'ALL', maxSeconds: Infinity },
  { key: '7d', label: '7D', maxSeconds: 7 * 86400 },
  { key: '30d', label: '30D', maxSeconds: 30 * 86400 },
  { key: '90d', label: '90D', maxSeconds: 90 * 86400 },
  { key: '180d', label: '180D', maxSeconds: 180 * 86400 },
  { key: '365d', label: '1Y', maxSeconds: 366 * 86400 },
]

function hasOrdersForTab(available: number[], maxSeconds: number): boolean {
  if (maxSeconds === Infinity) return available.length > 0
  return available.some((d) => d <= maxSeconds)
}

export function DurationFilter({ value, onChange, available }: DurationFilterProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {DURATION_TABS.map((tab) => {
        const hasOrders = tab.key === 'all' || hasOrdersForTab(available, tab.maxSeconds)
        if (!hasOrders && tab.key !== 'all') return null

        const isActive = value === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide border transition-colors duration-100 cursor-pointer',
              isActive
                ? 'bg-star/20 text-star border-star/40'
                : 'bg-abyss text-dust border-edge/20 hover:text-chalk hover:border-edge/40',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
