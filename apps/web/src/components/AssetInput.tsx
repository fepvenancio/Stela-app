'use client'

import { useState } from 'react'
import type { AssetType, TokenInfo } from '@stela/core'
import { getTokensForNetwork } from '@stela/core'
import { NETWORK } from '@/lib/config'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'

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

const networkTokens = getTokensForNetwork(NETWORK)

function getSelectedToken(address: string): TokenInfo | undefined {
  return networkTokens.find(
    (t) => t.addresses[NETWORK]?.toLowerCase() === address.toLowerCase(),
  )
}

function getTokenSymbol(address: string): string {
  return getSelectedToken(address)?.symbol ?? ''
}

/** Truncate address for display */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Generate a deterministic color from a string */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 55%, 45%)`
}

export function AssetInput({ index, value, onChange, onRemove }: AssetInputProps) {
  const [isCustom, setIsCustom] = useState(() => {
    if (!value.asset) return false
    return !getSelectedToken(value.asset)
  })
  const [modalOpen, setModalOpen] = useState(false)

  const selectedToken = getSelectedToken(value.asset)
  const symbol = getTokenSymbol(value.asset)
  const showTokenId = value.asset_type === 'ERC721' || value.asset_type === 'ERC1155'

  function handleTokenSelect(token: TokenInfo) {
    setIsCustom(false)
    onChange({
      ...value,
      asset: token.addresses[NETWORK] ?? '',
      decimals: token.decimals,
    })
  }

  function handleCustomSelect() {
    setIsCustom(true)
    onChange({ ...value, asset: '', decimals: 18 })
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-abyss/50 border border-edge">
      <span className="mt-2.5 text-[11px] text-ash font-mono w-4 text-right shrink-0">
        {index + 1}
      </span>

      <div className="flex-1 space-y-2">
        {/* Row 1: Asset type + Token selector button */}
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

          {/* Token selector trigger button */}
          <div>
            <Label htmlFor={`token-select-${index}`} className="sr-only">Token</Label>
            <button
              type="button"
              id={`token-select-${index}`}
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-xl bg-surface border border-edge text-sm transition-colors hover:bg-elevated hover:border-edge-bright focus-visible:border-star focus-visible:ring-1 focus-visible:ring-star/30 outline-none"
            >
              {selectedToken ? (
                <>
                  {/* Token avatar */}
                  {selectedToken.logoUrl ? (
                    <img
                      src={selectedToken.logoUrl}
                      alt={selectedToken.symbol}
                      width={20}
                      height={20}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                      style={{ backgroundColor: stringToColor(selectedToken.symbol) }}
                    >
                      {selectedToken.symbol.charAt(0)}
                    </div>
                  )}
                  <span className="text-chalk font-medium truncate">
                    {selectedToken.symbol}
                  </span>
                  <span className="text-ash text-xs font-mono ml-auto hidden sm:block">
                    {truncateAddress(selectedToken.addresses[NETWORK] ?? '')}
                  </span>
                </>
              ) : isCustom && value.asset ? (
                <>
                  <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-edge-bright text-dust text-[10px]">
                    ?
                  </div>
                  <span className="text-chalk font-mono text-xs truncate">
                    {truncateAddress(value.asset)}
                  </span>
                </>
              ) : (
                <span className="text-dust">Select token</span>
              )}

              {/* Chevron */}
              <svg
                className="ml-auto shrink-0 text-ash"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
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

      {/* Token Selector Modal */}
      <TokenSelectorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSelect={handleTokenSelect}
        selectedAddress={value.asset}
        showCustomOption={true}
        onCustomSelect={handleCustomSelect}
      />
    </div>
  )
}
