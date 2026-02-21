'use client'

import { useState } from 'react'
import type { AssetType, TokenInfo } from '@stela/core'
import { getTokensForNetwork } from '@stela/core'
import { NETWORK } from '@/lib/config'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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
          <div>
            <Label htmlFor={`asset-type-${index}`} className="sr-only">Asset type</Label>
            <Select
              value={value.asset_type}
              onValueChange={(v) => onChange({ ...value, asset_type: v as AssetType })}
            >
              <SelectTrigger id={`asset-type-${index}`} className="w-full bg-surface border-edge text-chalk text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor={`token-select-${index}`} className="sr-only">Token</Label>
            <Select
              value={selectedKey}
              onValueChange={handleTokenSelect}
            >
              <SelectTrigger id={`token-select-${index}`} className="w-full bg-surface border-edge text-chalk text-sm h-9">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {networkTokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    {t.symbol} — {t.name}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TOKEN_KEY}>Custom token</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Custom address (only when custom selected) */}
        {isCustom && (
          <div>
            <Label htmlFor={`custom-addr-${index}`} className="sr-only">Contract address</Label>
            <Input
              id={`custom-addr-${index}`}
              type="text"
              placeholder="Contract address (0x...)"
              value={value.asset}
              onChange={(e) => onChange({ ...value, asset: e.target.value })}
              className="font-mono"
            />
          </div>
        )}

        {/* Row 3: Amount + Token ID (conditional) */}
        <div className={`grid gap-2 ${showTokenId ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="relative">
            <Label htmlFor={`amount-${index}`} className="sr-only">Amount</Label>
            <Input
              id={`amount-${index}`}
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
              className={symbol ? 'pr-16' : ''}
            />
            {symbol && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dust font-mono pointer-events-none">
                {symbol}
              </span>
            )}
          </div>

          {showTokenId && (
            <div>
              <Label htmlFor={`token-id-${index}`} className="sr-only">Token ID</Label>
              <Input
                id={`token-id-${index}`}
                type="text"
                inputMode="numeric"
                placeholder="Token ID"
                value={value.token_id}
                onChange={(e) => onChange({ ...value, token_id: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        className="mt-2 text-ash hover:text-nova hover:bg-nova/10 shrink-0"
        aria-label="Remove asset"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </Button>
    </div>
  )
}
