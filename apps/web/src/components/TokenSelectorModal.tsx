'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { TokenInfo } from '@stela/core'
import { getTokensForNetwork } from '@stela/core'
import { NETWORK } from '@/lib/config'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/* ── Helpers ────────────────────────────────────────────── */

const networkTokens = getTokensForNetwork(NETWORK)

/** Popular tokens shown as quick-select chips */
const POPULAR_SYMBOLS = ['ETH', 'STRK', 'USDC', 'USDT', 'WBTC']

/** Truncate an address to 0x1a2b...3c4d format */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Generate a deterministic color from a string (for avatar fallback) */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 55%, 45%)`
}

/* ── Token Avatar ───────────────────────────────────────── */

function TokenAvatar({
  token,
  size = 36,
}: {
  token: TokenInfo
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const bgColor = stringToColor(token.symbol)

  if (token.logoUrl && !imgError) {
    return (
      <div
        className="relative shrink-0 rounded-full overflow-hidden bg-surface"
        style={{ width: size, height: size }}
      >
        <img
          src={token.logoUrl}
          alt={token.symbol}
          width={size}
          height={size}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  // Fallback: colored circle with first letter
  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
      }}
    >
      {token.symbol.charAt(0).toUpperCase()}
    </div>
  )
}

/* ── Custom Token Avatar ────────────────────────────────── */

function CustomTokenAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center bg-edge-bright text-dust"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </div>
  )
}

/* ── Quick Select Chip ──────────────────────────────────── */

function QuickChip({
  token,
  onClick,
}: {
  token: TokenInfo
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-edge bg-surface hover:bg-elevated hover:border-edge-bright transition-colors text-sm text-chalk"
    >
      <TokenAvatar token={token} size={20} />
      <span className="font-medium">{token.symbol}</span>
    </button>
  )
}

/* ── Token Row ──────────────────────────────────────────── */

function TokenRow({
  token,
  address,
  isSelected,
  onClick,
}: {
  token: TokenInfo
  address: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left
        ${isSelected
          ? 'bg-star/10 border border-star/30'
          : 'hover:bg-elevated/70 border border-transparent'
        }
      `}
    >
      <TokenAvatar token={token} size={36} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-chalk truncate">{token.name}</div>
        <div className="text-xs text-dust">{token.symbol}</div>
      </div>

      <div className="text-xs text-ash font-mono shrink-0">
        {truncateAddress(address)}
      </div>
    </button>
  )
}

/* ── Main Modal Component ───────────────────────────────── */

export interface TokenSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (token: TokenInfo) => void
  /** Currently selected token address (to highlight) */
  selectedAddress?: string
  /** Also show a "Custom token" option */
  showCustomOption?: boolean
  onCustomSelect?: () => void
}

export function TokenSelectorModal({
  open,
  onOpenChange,
  onSelect,
  selectedAddress = '',
  showCustomOption = true,
  onCustomSelect,
}: TokenSelectorModalProps) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setSearch('')
      // Small delay so the dialog animation completes
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Filter tokens by search
  const filteredTokens = useMemo(() => {
    if (!search.trim()) return networkTokens
    const q = search.toLowerCase().trim()
    return networkTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.addresses[NETWORK] ?? '').toLowerCase().includes(q),
    )
  }, [search])

  // Popular tokens for quick chips
  const popularTokens = useMemo(
    () => networkTokens.filter((t) => POPULAR_SYMBOLS.includes(t.symbol)),
    [],
  )

  const handleSelect = useCallback(
    (token: TokenInfo) => {
      onSelect(token)
      onOpenChange(false)
    },
    [onSelect, onOpenChange],
  )

  const handleCustom = useCallback(() => {
    onCustomSelect?.()
    onOpenChange(false)
  }, [onCustomSelect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-abyss border-edge text-chalk p-0 gap-0 max-w-md overflow-hidden"
        showCloseButton={true}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-chalk text-lg font-semibold">
            Select a token
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-3">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tokens"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-edge text-chalk text-sm placeholder:text-ash outline-none focus:border-star focus:ring-1 focus:ring-star/30 transition-colors"
            />
          </div>
        </div>

        {/* Quick Select Chips */}
        {!search && (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {popularTokens.map((t) => (
              <QuickChip
                key={t.symbol}
                token={t}
                onClick={() => handleSelect(t)}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 mt-3 border-t border-edge" />

        {/* Token List */}
        <div className="overflow-y-auto max-h-[340px] px-2 py-2 space-y-0.5">
          {filteredTokens.length === 0 && (
            <div className="text-center py-8 text-ash text-sm">
              No tokens found for &ldquo;{search}&rdquo;
            </div>
          )}

          {filteredTokens.map((t) => {
            const addr = t.addresses[NETWORK] ?? ''
            return (
              <TokenRow
                key={t.symbol}
                token={t}
                address={addr}
                isSelected={addr.toLowerCase() === selectedAddress.toLowerCase()}
                onClick={() => handleSelect(t)}
              />
            )
          })}

          {/* Custom Token Option */}
          {showCustomOption && (
            <>
              {filteredTokens.length > 0 && (
                <div className="mx-3 my-1 border-t border-edge/50" />
              )}
              <button
                type="button"
                onClick={handleCustom}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated/70 transition-colors text-left border border-transparent"
              >
                <CustomTokenAvatar size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-chalk">Custom token</div>
                  <div className="text-xs text-dust">Enter a contract address</div>
                </div>
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
