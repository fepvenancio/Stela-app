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
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-transparent text-gray-400 border-transparent hover:text-white',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums',
                  isActive
                    ? 'bg-accent/30 text-accent'
                    : 'bg-white/[0.1] text-gray-500',
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
