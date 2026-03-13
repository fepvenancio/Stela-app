'use client'

import { cn } from '@/lib/utils'

interface ModeToggleProps {
  value: 'lending' | 'swap'
  onChange: (v: 'lending' | 'swap') => void
  lendingCount: number
  swapCount: number
}

export function ModeToggle({ value, onChange, lendingCount, swapCount }: ModeToggleProps) {
  const tabs: { key: 'lending' | 'swap'; label: string; count: number }[] = [
    { key: 'lending', label: 'Lending', count: lendingCount },
    { key: 'swap', label: 'Swaps', count: swapCount },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {tabs.map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide border transition-colors duration-100 cursor-pointer',
              isActive
                ? 'bg-star/20 text-star border-star/40'
                : 'bg-transparent text-dust border-transparent hover:text-chalk',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums',
                  isActive
                    ? 'bg-star/30 text-star'
                    : 'bg-edge/30 text-ash',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
