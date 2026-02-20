'use client'

import { useState } from 'react'
import type { AssetType, TokenInfo } from '@stela/core'
import { getTokensForNetwork } from '@stela/core'
import { NETWORK } from '@/lib/config'

export interface AssetInputValue {
  asset: string
  asset_type: AssetType
  value: string
  token_id: string
  decimals: number
}

interface AssetInputProps {
  index: number
  value: AssetInputValue
  onChange: (val: AssetInputValue) => void
  onRemove: () => void
}

const ASSET_TYPES: AssetType[] = ['ERC20', 'ERC721', 'ERC1155', 'ERC4626']

const CUSTOM_TOKEN_KEY = '__custom__'

const inputBase =
  'bg-surface border border-edge rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-dust focus:border-star focus:outline-none transition-colors'

const networkTokens = getTokensForNetwork(NETWORK)

function getSelectedTokenKey(address: string): string {
  const match = networkTokens.find(
    (t) => t.addresses[NETWORK]?.toLowerCase() === address.toLowerCase(),
  )
  return match ? match.symbol : address ? CUSTOM_TOKEN_KEY : ''
}

function getTokenSymbol(address: string): string {
  const match = networkTokens.find(
    (t) => t.addresses[NETWORK]?.toLowerCase() === address.toLowerCase(),
  )
  return match?.symbol ?? ''
}

export function AssetInput({ index, value, onChange, onRemove }: AssetInputProps) {
  const [isCustom, setIsCustom] = useState(() => {
    if (!value.asset) return false
    return getSelectedTokenKey(value.asset) === CUSTOM_TOKEN_KEY
  })

  const selectedKey = isCustom ? CUSTOM_TOKEN_KEY : getSelectedTokenKey(value.asset)
  const symbol = getTokenSymbol(value.asset)
  const showTokenId = value.asset_type === 'ERC721' || value.asset_type === 'ERC1155'

  function handleTokenSelect(key: string) {
    if (key === CUSTOM_TOKEN_KEY) {
      setIsCustom(true)
      onChange({ ...value, asset: '', decimals: 18 })
      return
    }
    if (key === '') return

    const token = networkTokens.find((t) => t.symbol === key) as TokenInfo
    setIsCustom(false)
    onChange({
      ...value,
      asset: token.addresses[NETWORK] ?? '',
      decimals: token.decimals,
    })
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-abyss/50 border border-edge">
      <span className="mt-2.5 text-[11px] text-ash font-mono w-4 text-right shrink-0">
        {index + 1}
      </span>

      <div className="flex-1 space-y-2">
        {/* Row 1: Asset type + Token selector */}
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <select
            value={value.asset_type}
            onChange={(e) => onChange({ ...value, asset_type: e.target.value as AssetType })}
            className={inputBase}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={selectedKey}
            onChange={(e) => handleTokenSelect(e.target.value)}
            className={inputBase}
          >
            <option value="" disabled>Select token</option>
            {networkTokens.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol} — {t.name}
              </option>
            ))}
            <option value={CUSTOM_TOKEN_KEY}>Custom token</option>
          </select>
        </div>

        {/* Row 2: Custom address (only when custom selected) */}
        {isCustom && (
          <input
            type="text"
            placeholder="Contract address (0x...)"
            value={value.asset}
            onChange={(e) => onChange({ ...value, asset: e.target.value })}
            className={`${inputBase} w-full font-mono`}
          />
        )}

        {/* Row 3: Amount + Token ID (conditional) */}
        <div className={`grid gap-2 ${showTokenId ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={value.value}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                  onChange({ ...value, value: raw })
                }
              }}
              className={`${inputBase} w-full ${symbol ? 'pr-16' : ''}`}
            />
            {symbol && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dust font-mono pointer-events-none">
                {symbol}
              </span>
            )}
          </div>

          {showTokenId && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="Token ID"
              value={value.token_id}
              onChange={(e) => onChange({ ...value, token_id: e.target.value })}
              className={inputBase}
            />
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="mt-2 p-1.5 rounded-lg text-ash hover:text-nova hover:bg-nova/10 transition-colors shrink-0"
        aria-label="Remove asset"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}
