'use client'

import { useMemo } from 'react'
import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { formatAddress } from '@/lib/address'
import { formatDuration, formatTimestamp } from '@/lib/format'
import type { MatchedOrder } from '@/hooks/useInstantSettle'

interface MatchFoundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matches: MatchedOrder[]
  onSettle: (match: MatchedOrder) => void
  onSkip: () => void
  isPending: boolean
}

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

function MatchCard({
  match,
  onSettle,
  isPending,
}: {
  match: MatchedOrder
  onSettle: () => void
  isPending: boolean
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
  const deadline = Number(orderData.deadline ?? match.deadline ?? '0')
  const isSwap = duration === 0
  const secondsLeft = deadline - Math.floor(Date.now() / 1000)

  return (
    <div className="rounded-xl border border-edge/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface/10 border-b border-edge/20">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
            isSwap ? 'bg-aurora/10 text-aurora' : 'bg-nebula/10 text-nebula'
          }`}>
            {isSwap ? 'Swap' : 'Loan'}
          </span>
          <span className="text-[10px] text-ash font-mono">{formatAddress(match.borrower)}</span>
        </div>
        {secondsLeft > 0 && (
          <span className="text-[10px] text-ash">
            expires {formatTimestamp(BigInt(deadline))}
          </span>
        )}
      </div>

      {/* Assets */}
      <div className="px-4 py-3 space-y-2">
        {/* What they want to borrow (their debt = what you'll lend) */}
        <div>
          <span className="text-[9px] text-ash uppercase tracking-widest font-bold">They borrow (you lend)</span>
          <div className="mt-1 space-y-1">
            {debtAssets.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <TokenAvatarByAddress address={a.address} size={16} />
                <span className="text-sm text-chalk font-medium">
                  {a.formatted} <span className="text-dust">{a.symbol}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What they offer as collateral (their collateral = what you receive if liquidated) */}
        <div>
          <span className="text-[9px] text-star uppercase tracking-widest font-bold">Their collateral</span>
          <div className="mt-1 space-y-1">
            {collateralAssets.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <TokenAvatarByAddress address={a.address} size={16} />
                <span className="text-sm text-chalk font-medium">
                  {a.formatted} <span className="text-dust">{a.symbol}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Interest */}
        {interestAssets.length > 0 && (
          <div>
            <span className="text-[9px] text-aurora uppercase tracking-widest font-bold">Interest you earn</span>
            <div className="mt-1 space-y-1">
              {interestAssets.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TokenAvatarByAddress address={a.address} size={16} />
                  <span className="text-sm text-chalk font-medium">
                    {a.formatted} <span className="text-dust">{a.symbol}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duration */}
        {!isSwap && (
          <div className="flex items-center gap-4 text-[11px] text-ash pt-1">
            <span>Duration: <span className="text-chalk">{formatDuration(duration)}</span></span>
          </div>
        )}
      </div>

      {/* Settle button */}
      <div className="px-4 pb-3">
        <Button
          variant="gold"
          className="w-full"
          onClick={onSettle}
          disabled={isPending}
        >
          {isPending ? 'Settling...' : 'Settle Now & Earn 5 BPS'}
        </Button>
      </div>
    </div>
  )
}

export function MatchFoundModal({
  open,
  onOpenChange,
  matches,
  onSettle,
  onSkip,
  isPending,
}: MatchFoundModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onOpenChange(false) }}>
      <DialogContent className="bg-abyss border-edge text-chalk p-0 gap-0 sm:max-w-md overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
            Instant Match Found
          </DialogTitle>
          <p className="text-xs text-dust mt-1">
            {matches.length === 1
              ? 'A compatible order exists! You can settle it instantly as the lender.'
              : `${matches.length} compatible orders found. Pick one to settle instantly.`}
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onSettle={() => onSettle(match)}
              isPending={isPending}
            />
          ))}
        </div>

        <DialogFooter className="px-5 pb-5 pt-0">
          <Button
            variant="ghost"
            className="w-full text-ash hover:text-chalk"
            onClick={onSkip}
            disabled={isPending}
          >
            Skip — Post My Order Instead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
