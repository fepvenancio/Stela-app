'use client'

import { useMemo } from 'react'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatTokenValue } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface SelectionActionBarProps {
  onReview: () => void
}

export function SelectionActionBar({ onReview }: SelectionActionBarProps) {
  const { selected, clearAll, count } = useBatchSelection()

  const tokenTotals = useMemo(() => {
    const totals = new Map<string, bigint>()
    for (const [, inscription] of selected) {
      for (const asset of inscription.assets.filter((a) => a.asset_role === 'debt')) {
        const addr = asset.asset_address.toLowerCase()
        const val = BigInt(asset.value || '0')
        totals.set(addr, (totals.get(addr) ?? 0n) + val)
      }
    }
    return totals
  }, [selected])

  if (count === 0) return null

  return (
    <div role="status" aria-live="polite" aria-label={`${count} inscription${count !== 1 ? 's' : ''} selected`} className="sticky top-0 z-30 -mx-4 px-4 py-3 mb-4 bg-void/90 backdrop-blur-xl border-b border-star/20">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Count badge */}
        <div className="w-8 h-8 rounded-full bg-star/20 flex items-center justify-center text-star font-bold text-xs shrink-0">
          {count}
        </div>

        {/* Token totals */}
        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-x-auto">
          {Array.from(tokenTotals.entries()).map(([addr, total]) => {
            const token = findTokenByAddress(addr)
            return (
              <div key={addr} className="flex items-center gap-1.5 shrink-0">
                <TokenAvatarByAddress address={addr} size={16} />
                <span className="text-xs font-medium text-chalk whitespace-nowrap">
                  {formatTokenValue(total.toString(), token?.decimals ?? 18)} {token?.symbol}
                </span>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-ash hover:text-chalk h-8 px-3 gap-1.5" aria-label="Clear all selections">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={onReview}
            className="h-8 px-5 rounded-xl font-bold shadow-lg shadow-star/20"
          >
            Review & Lend
          </Button>
        </div>
      </div>
    </div>
  )
}
