'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { formatTokenValue } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { TokenAvatar } from '@/components/TokenAvatar'
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
  balance,
  onClick,
}: {
  token: TokenInfo
  balance?: bigint
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
      {balance !== undefined && balance > 0n && (
        <span className="text-[10px] text-star font-mono">
          {formatTokenValue(balance.toString(), token.decimals)}
        </span>
      )}
    </button>
  )
}

/* ── Token Row ──────────────────────────────────────────── */

function TokenRow({
  token,
  address,
  isSelected,
  balance,
  onClick,
}: {
  token: TokenInfo
  address: string
  isSelected: boolean
  balance?: bigint
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

      <div className="text-right shrink-0">
        {balance !== undefined && balance > 0n ? (
          <>
            <div className="text-sm text-chalk font-mono">
              {formatTokenValue(balance.toString(), token.decimals)}
            </div>
            <div className="text-[10px] text-ash font-mono">
              {formatAddress(address)}
            </div>
          </>
        ) : (
          <div className="text-xs text-ash font-mono">
            {balance !== undefined && balance === 0n ? (
              <span className="text-ash/50">0</span>
            ) : (
              formatAddress(address)
            )}
          </div>
        )}
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
  /** Token balances from the connected wallet (tokenAddress lowercase → bigint) */
  balances?: Map<string, bigint>
}

export function TokenSelectorModal({
  open,
  onOpenChange,
  onSelect,
  selectedAddress = '',
  showCustomOption = true,
  onCustomSelect,
  balances,
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

  const walletConnected = balances !== undefined && balances.size > 0

  // Filter tokens: when wallet connected, only show tokens with balance > 0
  // When searching, also search all tokens (so user can find tokens to use custom address)
  const filteredTokens = useMemo(() => {
    let tokens = networkTokens

    // When wallet is connected and not searching, only show held tokens
    if (walletConnected && !search.trim()) {
      tokens = tokens.filter((t) => {
        const addr = (t.addresses[NETWORK] ?? '').toLowerCase()
        const bal = balances.get(addr) ?? 0n
        return bal > 0n
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      tokens = tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.addresses[NETWORK] ?? '').toLowerCase().includes(q),
      )
      // When searching with wallet, still prioritize held tokens
      if (walletConnected) {
        tokens = [...tokens].sort((a, b) => {
          const balA = balances.get((a.addresses[NETWORK] ?? '').toLowerCase()) ?? 0n
          const balB = balances.get((b.addresses[NETWORK] ?? '').toLowerCase()) ?? 0n
          if (balA > 0n && balB === 0n) return -1
          if (balA === 0n && balB > 0n) return 1
          if (balA > balB) return -1
          if (balA < balB) return 1
          return 0
        })
      }
    } else if (walletConnected) {
      // Sort held tokens by balance (highest first)
      tokens = [...tokens].sort((a, b) => {
        const balA = balances.get((a.addresses[NETWORK] ?? '').toLowerCase()) ?? 0n
        const balB = balances.get((b.addresses[NETWORK] ?? '').toLowerCase()) ?? 0n
        if (balA > balB) return -1
        if (balA < balB) return 1
        return 0
      })
    }

    return tokens
  }, [search, balances, walletConnected])

  // Popular tokens for quick chips — only show ones the user holds when connected
  const popularTokens = useMemo(
    () => {
      const popular = networkTokens.filter((t) => POPULAR_SYMBOLS.includes(t.symbol))
      if (!walletConnected) return popular
      return popular.filter((t) => {
        const addr = (t.addresses[NETWORK] ?? '').toLowerCase()
        return (balances.get(addr) ?? 0n) > 0n
      })
    },
    [walletConnected, balances],
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
            {walletConnected ? 'Your tokens' : 'Select a token'}
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
                balance={balances?.get((t.addresses[NETWORK] ?? '').toLowerCase())}
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
              {search.trim()
                ? <>No tokens found for &ldquo;{search}&rdquo;</>
                : walletConnected
                  ? 'No tokens in your wallet. Use custom token below.'
                  : 'No tokens available'}
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
                balance={balances?.get(addr.toLowerCase())}
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
