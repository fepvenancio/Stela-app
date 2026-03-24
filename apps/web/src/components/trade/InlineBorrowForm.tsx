'use client'

import { useState, useCallback } from 'react'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar } from '@/components/TokenAvatar'
import { formatTokenValue } from '@/lib/format'

/* ── Types ──────────────────────────────────────────────── */

type RowKey = 'debt' | 'collateral' | 'interest'

interface RowConfig {
  key: RowKey
  loanLabel: string
  swapLabel: string
  accentClass: string
  borderClass: string
  bgClass: string
}

const ROW_CONFIGS: RowConfig[] = [
  {
    key: 'debt',
    loanLabel: 'I want to borrow',
    swapLabel: 'I receive',
    accentClass: 'text-green-500',
    borderClass: 'border-green-500/20',
    bgClass: 'bg-green-500/5',
  },
  {
    key: 'collateral',
    loanLabel: "I'll put up",
    swapLabel: 'I give',
    accentClass: 'text-accent',
    borderClass: 'border-accent/20',
    bgClass: 'bg-accent/5',
  },
  {
    key: 'interest',
    loanLabel: "I'll pay interest",
    swapLabel: '',
    accentClass: 'text-sky-400',
    borderClass: 'border-sky-400/20',
    bgClass: 'bg-sky-400/5',
  },
]

/* ── Props ──────────────────────────────────────────────── */

export interface InlineBorrowFormProps {
  orderType: 'lending' | 'swap'
  debtAssets: AssetInputValue[]
  collateralAssets: AssetInputValue[]
  interestAssets: AssetInputValue[]
  onDebtChange: (assets: AssetInputValue[]) => void
  onCollateralChange: (assets: AssetInputValue[]) => void
  onInterestChange: (assets: AssetInputValue[]) => void
  balances: Map<string, bigint>
}

/* ── Empty asset helper ─────────────────────────────────── */

function emptyAsset(): AssetInputValue {
  return { asset: '', asset_type: 'ERC20', value: '', token_id: '0', decimals: 18 }
}

/* ── Single Asset Row ───────────────────────────────────── */

function AssetInputRow({
  asset,
  index,
  rowConfig,
  balances,
  onTokenClick,
  onAmountChange,
  onRemove,
  canRemove,
}: {
  asset: AssetInputValue
  index: number
  rowConfig: RowConfig
  balances: Map<string, bigint>
  onTokenClick: () => void
  onAmountChange: (raw: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const token = asset.asset ? findTokenByAddress(asset.asset) : null
  const address = asset.asset?.toLowerCase() ?? ''
  const balance = address ? balances.get(address) : undefined

  return (
    <div className="group">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Token selector button */}
        <button
          type="button"
          onClick={onTokenClick}
          className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface/60 border border-border/40 text-sm transition-colors hover:bg-surface-hover hover:border-white/20 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/30 outline-none cursor-pointer shrink-0 sm:min-w-[160px]"
        >
          {token ? (
            <>
              <TokenAvatar token={token} size={22} />
              <span className="text-white font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-gray-400">Select Token</span>
          )}
          <svg
            className="ml-auto shrink-0 text-gray-500"
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

        {/* Amount input */}
        <div className="flex-1 relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={asset.value}
            onChange={(e) => onAmountChange(e.target.value)}
            className={`w-full h-11 px-4 rounded-xl bg-surface/60 border border-border/40 text-white text-lg font-mono placeholder:text-gray-500/40 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors ${
              token ? 'pr-16' : ''
            }`}
          />
          {token && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono pointer-events-none">
              {token.symbol}
            </span>
          )}
        </div>

        {/* Remove button */}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center w-11 h-11 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Remove asset"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Balance display */}
      {token && balance !== undefined && balance > 0n && (
        <div className="mt-1 text-right pr-1">
          <span className="text-[10px] text-gray-400 font-mono">
            Balance: {formatTokenValue(balance.toString(), token.decimals)}
          </span>
          <button
            type="button"
            onClick={() => {
              const formatted = formatTokenValue(balance.toString(), token.decimals)
              onAmountChange(formatted)
            }}
            className="ml-1.5 text-[10px] text-accent hover:text-accent/80 font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            Max
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Component ──────────────────────────────────────────── */

export function InlineBorrowForm({
  orderType,
  debtAssets,
  collateralAssets,
  interestAssets,
  onDebtChange,
  onCollateralChange,
  onInterestChange,
  balances,
}: InlineBorrowFormProps) {
  // Track which (role, index) is selecting a token
  const [openSelector, setOpenSelector] = useState<{ key: RowKey; index: number } | null>(null)

  const isSwap = orderType === 'swap'
  const rows = isSwap ? ROW_CONFIGS.filter((r) => r.key !== 'interest') : ROW_CONFIGS

  const getAssets = useCallback(
    (key: RowKey): AssetInputValue[] => {
      return key === 'debt' ? debtAssets : key === 'collateral' ? collateralAssets : interestAssets
    },
    [debtAssets, collateralAssets, interestAssets],
  )

  const getSetter = useCallback(
    (key: RowKey) => {
      return key === 'debt' ? onDebtChange : key === 'collateral' ? onCollateralChange : onInterestChange
    },
    [onDebtChange, onCollateralChange, onInterestChange],
  )

  const handleTokenSelect = useCallback(
    (key: RowKey, index: number, token: TokenInfo) => {
      const arr = [...getAssets(key)]
      const current = arr[index] ?? emptyAsset()
      arr[index] = {
        ...current,
        asset: token.addresses[NETWORK] ?? '',
        asset_type: 'ERC20',
        decimals: token.decimals,
      }
      getSetter(key)(arr)
      setOpenSelector(null)
    },
    [getAssets, getSetter],
  )

  const handleAmountChange = useCallback(
    (key: RowKey, index: number, raw: string) => {
      if (raw !== '' && !/^\d*\.?\d{0,18}$/.test(raw)) return
      const arr = [...getAssets(key)]
      const current = arr[index] ?? emptyAsset()
      arr[index] = { ...current, value: raw }
      getSetter(key)(arr)
    },
    [getAssets, getSetter],
  )

  const handleAddRow = useCallback(
    (key: RowKey) => {
      const arr = [...getAssets(key), emptyAsset()]
      getSetter(key)(arr)
    },
    [getAssets, getSetter],
  )

  const handleRemoveRow = useCallback(
    (key: RowKey, index: number) => {
      const arr = getAssets(key).filter((_, i) => i !== index)
      getSetter(key)(arr)
    },
    [getAssets, getSetter],
  )

  return (
    <section className="space-y-3">
      {rows.map((row) => {
        const assets = getAssets(row.key)
        // Always show at least one empty row
        const displayAssets = assets.length > 0 ? assets : [emptyAsset()]
        const label = isSwap ? row.swapLabel : row.loanLabel
        // Allow adding more if the last asset has a token selected
        const lastAsset = displayAssets[displayAssets.length - 1]
        const canAddMore = lastAsset.asset !== ''

        return (
          <div
            key={row.key}
            className={`rounded-xl border ${row.borderClass} ${row.bgClass} p-4 transition-colors`}
          >
            {/* Section label */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] uppercase tracking-widest font-bold ${row.accentClass}`}>
                {label}
              </span>
              {assets.length > 0 && (
                <span className="text-[10px] text-gray-400 font-mono">
                  {assets.filter(a => a.asset).length} asset{assets.filter(a => a.asset).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Asset rows */}
            <div className="space-y-2">
              {displayAssets.map((asset, index) => (
                <AssetInputRow
                  key={`${row.key}-${index}`}
                  asset={asset}
                  index={index}
                  rowConfig={row}
                  balances={balances}
                  onTokenClick={() => setOpenSelector({ key: row.key, index })}
                  onAmountChange={(raw) => handleAmountChange(row.key, index, raw)}
                  onRemove={() => handleRemoveRow(row.key, index)}
                  canRemove={assets.length > 0 && (assets.length > 1 || asset.asset !== '')}
                />
              ))}
            </div>

            {/* Add another button */}
            {canAddMore && (
              <button
                type="button"
                onClick={() => handleAddRow(row.key)}
                className={`flex items-center gap-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${row.accentClass} opacity-70 hover:opacity-100`}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2v8M2 6h8" />
                </svg>
                Add another
              </button>
            )}
          </div>
        )
      })}

      {/* Token Selector Modals — single modal controlled by openSelector state */}
      {rows.map((row) => {
        const assets = getAssets(row.key)
        const displayAssets = assets.length > 0 ? assets : [emptyAsset()]
        return displayAssets.map((asset, index) => (
          <TokenSelectorModal
            key={`selector-${row.key}-${index}`}
            open={openSelector?.key === row.key && openSelector?.index === index}
            onOpenChange={(open) => {
              if (!open) setOpenSelector(null)
            }}
            onSelect={(token) => handleTokenSelect(row.key, index, token)}
            selectedAddress={asset.asset}
            showCustomOption={false}
            balances={balances}
          />
        ))
      })}
    </section>
  )
}
