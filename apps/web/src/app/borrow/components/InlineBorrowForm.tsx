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
  label: string
  loanLabel: string
  swapLabel: string
  accentClass: string
  borderClass: string
  bgClass: string
}

const ROW_CONFIGS: RowConfig[] = [
  {
    key: 'debt',
    label: '',
    loanLabel: 'I want to borrow',
    swapLabel: 'I receive',
    accentClass: 'text-aurora',
    borderClass: 'border-aurora/20',
    bgClass: 'bg-aurora/5',
  },
  {
    key: 'collateral',
    label: '',
    loanLabel: "I'll put up",
    swapLabel: 'I give',
    accentClass: 'text-star',
    borderClass: 'border-star/20',
    bgClass: 'bg-star/5',
  },
  {
    key: 'interest',
    label: '',
    loanLabel: "I'll pay interest",
    swapLabel: '',
    accentClass: 'text-nebula',
    borderClass: 'border-nebula/20',
    bgClass: 'bg-nebula/5',
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
  /** Open AddAssetModal pre-configured for a specific role */
  onAddMore?: (role: RowKey) => void
}

/* ── Empty asset helper ─────────────────────────────────── */

function emptyAsset(): AssetInputValue {
  return { asset: '', asset_type: 'ERC20', value: '', token_id: '0', decimals: 18 }
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
  onAddMore,
}: InlineBorrowFormProps) {
  const [openSelector, setOpenSelector] = useState<RowKey | null>(null)

  const isSwap = orderType === 'swap'
  const rows = isSwap ? ROW_CONFIGS.filter((r) => r.key !== 'interest') : ROW_CONFIGS

  /* Get the first asset value for a given role */
  const getFirstAsset = useCallback(
    (key: RowKey): AssetInputValue => {
      const arr = key === 'debt' ? debtAssets : key === 'collateral' ? collateralAssets : interestAssets
      return arr.length > 0 ? arr[0] : emptyAsset()
    },
    [debtAssets, collateralAssets, interestAssets],
  )

  /* Update the first asset for a role, preserving any additional assets */
  const updateFirstAsset = useCallback(
    (key: RowKey, updated: AssetInputValue) => {
      const setter = key === 'debt' ? onDebtChange : key === 'collateral' ? onCollateralChange : onInterestChange
      const arr = key === 'debt' ? debtAssets : key === 'collateral' ? collateralAssets : interestAssets

      if (arr.length <= 1) {
        // Replace the entire array with just the new first element
        setter(updated.asset ? [updated] : [])
      } else {
        // Preserve additional assets beyond the first
        setter([updated, ...arr.slice(1)])
      }
    },
    [debtAssets, collateralAssets, interestAssets, onDebtChange, onCollateralChange, onInterestChange],
  )

  const handleTokenSelect = useCallback(
    (key: RowKey, token: TokenInfo) => {
      const current = getFirstAsset(key)
      updateFirstAsset(key, {
        ...current,
        asset: token.addresses[NETWORK] ?? '',
        asset_type: 'ERC20',
        decimals: token.decimals,
      })
      setOpenSelector(null)
    },
    [getFirstAsset, updateFirstAsset],
  )

  const handleAmountChange = useCallback(
    (key: RowKey, raw: string) => {
      if (raw !== '' && !/^\d*\.?\d{0,18}$/.test(raw)) return
      const current = getFirstAsset(key)
      updateFirstAsset(key, { ...current, value: raw })
    },
    [getFirstAsset, updateFirstAsset],
  )

  return (
    <section className="space-y-3">
      {rows.map((row) => {
        const asset = getFirstAsset(row.key)
        const token = asset.asset ? findTokenByAddress(asset.asset) : null
        const address = asset.asset?.toLowerCase() ?? ''
        const balance = address ? balances.get(address) : undefined
        const label = isSwap ? row.swapLabel : row.loanLabel

        const arr = row.key === 'debt' ? debtAssets : row.key === 'collateral' ? collateralAssets : interestAssets
        const extraCount = arr.length > 1 ? arr.length - 1 : 0
        const hasFirstAsset = !!(asset.asset && asset.value)

        return (
          <div
            key={row.key}
            className={`rounded-xl border ${row.borderClass} ${row.bgClass} p-4 transition-colors`}
          >
            {/* Label + Add More */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] uppercase tracking-widest font-bold ${row.accentClass}`}>
                {label}
                {extraCount > 0 && (
                  <span className="ml-2 text-dust font-normal normal-case tracking-normal">
                    +{extraCount} more
                  </span>
                )}
              </span>
              {hasFirstAsset && onAddMore && (
                <button
                  type="button"
                  onClick={() => onAddMore(row.key)}
                  className="flex items-center gap-1 text-[10px] text-star hover:text-star-bright font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
                  Add
                </button>
              )}
            </div>

            {/* Token selector + Amount input */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Token selector button */}
              <button
                type="button"
                onClick={() => setOpenSelector(row.key)}
                className="flex items-center gap-2 h-12 px-4 rounded-xl bg-surface/60 border border-edge/40 text-sm transition-colors hover:bg-elevated hover:border-edge-bright focus-visible:border-star focus-visible:ring-1 focus-visible:ring-star/30 outline-none cursor-pointer shrink-0 sm:min-w-[160px]"
              >
                {token ? (
                  <>
                    <TokenAvatar token={token} size={24} />
                    <span className="text-chalk font-medium">{token.symbol}</span>
                  </>
                ) : (
                  <span className="text-dust">Select Token</span>
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

              {/* Amount input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={asset.value}
                  onChange={(e) => handleAmountChange(row.key, e.target.value)}
                  className={`w-full h-12 px-4 rounded-xl bg-surface/60 border border-edge/40 text-chalk text-lg font-mono placeholder:text-ash/40 outline-none focus:border-star focus:ring-1 focus:ring-star/30 transition-colors ${
                    token ? 'pr-16' : ''
                  }`}
                />
                {token && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-dust font-mono pointer-events-none">
                    {token.symbol}
                  </span>
                )}
              </div>
            </div>

            {/* Balance display */}
            {token && balance !== undefined && balance > 0n && (
              <div className="mt-1.5 text-right">
                <span className="text-[10px] text-dust font-mono">
                  Balance: {formatTokenValue(balance.toString(), token.decimals)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const formatted = formatTokenValue(balance.toString(), token.decimals)
                    handleAmountChange(row.key, formatted)
                  }}
                  className="ml-1.5 text-[10px] text-star hover:text-star-bright font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Max
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Token Selector Modals — one per row, controlled via openSelector state */}
      {rows.map((row) => (
        <TokenSelectorModal
          key={`selector-${row.key}`}
          open={openSelector === row.key}
          onOpenChange={(open) => {
            if (!open) setOpenSelector(null)
          }}
          onSelect={(token) => handleTokenSelect(row.key, token)}
          selectedAddress={getFirstAsset(row.key).asset}
          showCustomOption={false}
          balances={balances}
        />
      ))}
    </section>
  )
}
