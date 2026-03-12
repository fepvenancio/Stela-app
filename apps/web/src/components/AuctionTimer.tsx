'use client'

import { useCountdown } from '@/hooks/useCountdown'

interface AuctionTimerProps {
  /** Unix timestamp when the timer expires */
  endTime: number
  /** Label to show before the timer (e.g., "Grace period" or "Auction ends") */
  label: string
}

/**
 * Reusable countdown component for grace periods and auctions.
 * Color transitions: green (>50%) -> yellow (25-50%) -> red (<25%).
 */
export function AuctionTimer({ endTime, label }: AuctionTimerProps) {
  const { totalSeconds, formatted, isExpired } = useCountdown(endTime)

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="inline-block h-2 w-2 rounded-full bg-nova" />
        <span className="text-nova">{label}: Expired</span>
      </div>
    )
  }

  // Color based on remaining time thresholds (1h = urgent, 6h = warning)
  const pct =
    totalSeconds > 21600 ? 100 : totalSeconds > 3600 ? 40 : totalSeconds > 0 ? 10 : 0

  const colorClass =
    pct > 50 ? 'text-aurora' : pct > 25 ? 'text-star' : 'text-nova'
  const dotClass =
    pct > 50 ? 'bg-aurora' : pct > 25 ? 'bg-star' : 'bg-nova'

  return (
    <div className="flex items-center gap-2 text-xs font-mono" suppressHydrationWarning>
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass} animate-pulse`} />
      <span className={colorClass}>
        {label}: {formatted}
      </span>
    </div>
  )
}
