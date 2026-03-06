'use client'

import { useMemo } from 'react'
import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'
import { formatDuration } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch } from '@/hooks/useMatchDetection'

/* ── Helpers ──────────────────────────────────────────── */

interface AssetDisplay {
  address: string
  type: string
  value: string
  tokenId: string
  symbol: string
  decimals: number
  formatted: string
}

function parseAssets(raw: unknown): AssetDisplay[] {
  if (!Array.isArray(raw)) return []
  return raw.map((a: Record<string, string>) => {
    const token = findTokenByAddress(a.asset_address)
    const decimals = token?.decimals ?? 18
    const isNft = a.asset_type === 'ERC721' || a.asset_type === 'ERC1155'
    return {
      address: a.asset_address,
      type: a.asset_type,
      value: a.value || '0',
      tokenId: a.token_id || '0',
      symbol: token?.symbol ?? formatAddress(a.asset_address),
      decimals,
      formatted: isNft ? `#${a.token_id}` : formatTokenValue(a.value || '0', decimals),
    }
  })
}

function AssetCell({ assets }: { assets: AssetDisplay[] }) {
  if (assets.length === 0) return <span className="text-ash/50 text-[10px]">None</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {assets.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <TokenAvatarByAddress address={a.address} size={14} />
          <span className="text-xs font-medium text-chalk">
            {a.formatted} <span className="text-dust">{a.symbol}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Off-Chain Match Row ──────────────────────────────── */

export function OffchainMatchListRow({
  match,
  isSwap,
  onSettle,
  isSettling,
}: {
  match: MatchedOrder
  isSwap: boolean
  onSettle: () => void
  isSettling: boolean
}) {
  const orderData = match.order_data
  const debtAssets = useMemo(
    () => parseAssets(orderData.debtAssets ?? orderData.debt_assets),
    [orderData],
  )
  const collateralAssets = useMemo(
    () => parseAssets(orderData.collateralAssets ?? orderData.collateral_assets),
    [orderData],
  )
  const interestAssets = useMemo(
    () => parseAssets(orderData.interestAssets ?? orderData.interest_assets),
    [orderData],
  )
  const duration = Number(orderData.duration ?? '0')

  return (
    <div className="group flex items-center gap-3 px-3 py-3 border-b transition-colors duration-100 border-edge/20 hover:bg-surface/30">
      {/* Desktop: grid matching ListingTableHeader */}
      <div className="hidden md:grid grid-cols-12 gap-3 flex-1 items-center min-h-[28px]">
        {/* Status + source */}
        <div className="col-span-2 flex items-center gap-1.5 min-w-0">
          <Badge variant="pending" className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
            {isSwap ? 'Swap' : 'Loan'}
          </Badge>
          <span className="text-[7px] text-ash/40 uppercase tracking-wider shrink-0">oc</span>
          <span className="font-mono text-[10px] text-dust tracking-wider truncate">
            {formatAddress(match.borrower)}
          </span>
        </div>

        {/* Debt */}
        <div className="col-span-3">
          <AssetCell assets={debtAssets} />
        </div>

        {/* Interest */}
        <div className="col-span-2">
          <AssetCell assets={interestAssets} />
        </div>

        {/* Collateral */}
        <div className="col-span-3">
          <AssetCell assets={collateralAssets} />
        </div>

        {/* Action */}
        <div className="col-span-2 flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSettle() }}
            disabled={isSettling}
            className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {isSettling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              isSwap ? 'Swap' : 'Settle'
            )}
          </button>
        </div>
      </div>

      {/* Mobile: compact two-line layout */}
      <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="pending" className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
              {isSwap ? 'Swap' : 'Loan'}
            </Badge>
            <span className="text-[7px] text-ash/40 uppercase tracking-wider">oc</span>
            <span className="font-mono text-[10px] text-dust">{formatAddress(match.borrower)}</span>
          </div>
          <span className="text-chalk text-[11px] font-medium shrink-0">{formatDuration(duration)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] text-dust uppercase">D</span>
              <AssetCell assets={debtAssets} />
            </div>
            <div className="text-edge/40">|</div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] text-dust uppercase">C</span>
              <AssetCell assets={collateralAssets} />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSettle() }}
            disabled={isSettling}
            className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {isSettling ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Settle'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── On-Chain Match Row ───────────────────────────────── */

export function OnchainMatchListRow({
  match,
  isSwap,
  onSettle,
  isSettling,
}: {
  match: OnChainMatch
  isSwap: boolean
  onSettle: () => void
  isSettling: boolean
}) {
  const debtAssets = useMemo(() => parseAssets(match.debtAssets), [match.debtAssets])
  const collateralAssets = useMemo(() => parseAssets(match.collateralAssets), [match.collateralAssets])
  const interestAssets = useMemo(() => parseAssets(match.interestAssets), [match.interestAssets])
  const duration = Number(match.duration ?? '0')

  return (
    <div className="group flex items-center gap-3 px-3 py-3 border-b transition-colors duration-100 border-edge/20 hover:bg-surface/30">
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-12 gap-3 flex-1 items-center min-h-[28px]">
        <div className="col-span-2 flex items-center gap-1.5 min-w-0">
          <Badge variant="open" className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
            {isSwap ? 'Swap' : 'Loan'}
          </Badge>
          <span className="font-mono text-[10px] text-dust tracking-wider truncate">
            {formatAddress(match.borrower)}
          </span>
        </div>

        <div className="col-span-3">
          <AssetCell assets={debtAssets} />
        </div>

        <div className="col-span-2">
          <AssetCell assets={interestAssets} />
        </div>

        <div className="col-span-3">
          <AssetCell assets={collateralAssets} />
        </div>

        <div className="col-span-2 flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSettle() }}
            disabled={isSettling}
            className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {isSettling ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="open" className="w-fit h-[18px] text-[8px] px-1.5 py-0 uppercase font-bold shrink-0">
              {isSwap ? 'Swap' : 'Loan'}
            </Badge>
            <span className="font-mono text-[10px] text-dust">{formatAddress(match.borrower)}</span>
          </div>
          <span className="text-chalk text-[11px] font-medium shrink-0">{formatDuration(duration)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] text-dust uppercase">D</span>
              <AssetCell assets={debtAssets} />
            </div>
            <div className="text-edge/40">|</div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] text-dust uppercase">C</span>
              <AssetCell assets={collateralAssets} />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSettle() }}
            disabled={isSettling}
            className="h-7 px-3 bg-star hover:bg-star-bright text-void text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {isSettling ? <Loader2 className="w-3 h-3 animate-spin" /> : isSwap ? 'Swap' : 'Lend'}
          </button>
        </div>
      </div>
    </div>
  )
}
