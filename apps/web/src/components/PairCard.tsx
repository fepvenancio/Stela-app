'use client'

import Link from 'next/link'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { TokenAvatar, stringToColor } from '@/components/TokenAvatar'
import { formatTokenValue } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import type { PairAggregate } from '@stela/core'

interface PairCardProps {
  pair: PairAggregate
}

function TokenIcon({ address, size = 28 }: { address: string; size?: number }) {
  const token = findTokenByAddress(address)
  if (token) return <TokenAvatar token={token} size={size} />
  const symbol = formatAddress(address)
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: stringToColor(symbol), fontSize: size * 0.35 }}
    >
      {symbol.charAt(0)}
    </div>
  )
}

export function PairCard({ pair }: PairCardProps) {
  const debtToken = findTokenByAddress(pair.debt_token)
  const collToken = findTokenByAddress(pair.collateral_token)

  const debtSymbol = debtToken?.symbol ?? formatAddress(pair.debt_token)
  const collSymbol = collToken?.symbol ?? formatAddress(pair.collateral_token)

  const activeCount = pair.open_count + pair.pending_order_count

  // Format volume with token decimals
  const volumeDisplay = debtToken
    ? formatTokenValue(pair.total_volume, debtToken.decimals)
    : pair.total_volume

  const pairSlug = `${pair.debt_token}-${pair.collateral_token}`

  return (
    <Link
      href={`/markets/${pairSlug}`}
      className="group flex items-center gap-4 p-4 rounded-xl border border-edge/30 bg-surface/10 hover:bg-surface/30 hover:border-edge/50 transition-all duration-200"
    >
      {/* Token pair avatars — overlapping */}
      <div className="relative shrink-0 w-[44px] h-[28px]">
        <div className="absolute left-0 top-0 z-[1]">
          <TokenIcon address={pair.debt_token} size={28} />
        </div>
        <div className="absolute left-[16px] top-0 ring-2 ring-void rounded-full">
          <TokenIcon address={pair.collateral_token} size={28} />
        </div>
      </div>

      {/* Pair name */}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-chalk group-hover:text-star transition-colors">
          {debtSymbol} / {collSymbol}
        </span>
        <p className="text-[10px] text-ash mt-0.5">
          {pair.total_count} total stela{pair.total_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 text-right">
        {/* Active listings */}
        <div className="min-w-[60px]">
          <p className="text-xs text-chalk font-medium">{activeCount}</p>
          <p className="text-[9px] text-ash uppercase tracking-wider">Active</p>
        </div>

        {/* Volume */}
        <div className="min-w-[80px]">
          <p className="text-xs text-chalk font-medium truncate">
            {volumeDisplay} {debtSymbol}
          </p>
          <p className="text-[9px] text-ash uppercase tracking-wider">Volume</p>
        </div>
      </div>

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-ash group-hover:text-star transition-colors shrink-0"
      >
        <path d="M6 4l4 4-4 4" />
      </svg>
    </Link>
  )
}
