'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import Link from 'next/link'
import { findTokenByAddress, InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import { RpcProvider } from 'starknet'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TokenAvatar, stringToColor } from '@/components/TokenAvatar'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { useSync } from '@/hooks/useSync'
import { toast } from 'sonner'
import type { TokenDisplay } from '@/types/orderbook'

type ActionTab = 'lend' | 'borrow' | 'swap'

interface BestOrder {
  id: string
  source: 'offchain' | 'onchain'
  apr: number
  amount: string
  duration: number
}

interface ActionWidgetProps {
  pair: { base: TokenDisplay; quote: TokenDisplay }
  bestLendingApr: number | null
  bestSwapRate: number | null
  mode: 'lending' | 'swap'
  selectedDuration: number | null
  bestOrder?: BestOrder | null
  onLend?: (orderId: string, source: 'offchain' | 'onchain') => Promise<void>
  isLending?: boolean
  /** Externally controlled active tab (for auto-switching from order book clicks) */
  activeTab?: ActionTab
  onTabChange?: (tab: ActionTab) => void
}

function TokenIcon({ token, size = 24 }: { token: TokenDisplay; size?: number }) {
  const resolved = findTokenByAddress(token.address)
  if (resolved) {
    return <TokenAvatar token={resolved} size={size} />
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: stringToColor(token.symbol), fontSize: size * 0.4 }}
    >
      {token.symbol.charAt(0).toUpperCase()}
    </div>
  )
}

function AmountInput({
  label,
  token,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string
  token: TokenDisplay
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="rounded-lg bg-void border border-edge/20 p-3 transition-colors focus-within:border-star/40">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-dust uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder ?? '0.00'}
          className={cn(
            'flex-1 bg-transparent text-lg font-mono text-chalk placeholder:text-ash/40 outline-none min-w-0',
            readOnly && 'cursor-default',
          )}
        />
        <div className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-lg bg-surface/60 border border-edge/20">
          <TokenIcon token={token} size={20} />
          <span className="text-sm font-medium text-chalk">{token.symbol}</span>
        </div>
      </div>
    </div>
  )
}

function formatDurationLabel(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '--'
  const days = Math.round(seconds / 86400)
  if (days < 1) return `${Math.round(seconds / 3600)}h`
  if (days >= 365) return `${(days / 365).toFixed(1)}y`
  return `${days}d`
}

function LendTab({
  pair,
  bestApr,
  selectedDuration,
  connected,
  pairParam,
  bestOrder,
  onLend,
  isLending: isLendingPending,
}: {
  pair: { base: TokenDisplay; quote: TokenDisplay }
  bestApr: number | null
  selectedDuration: number | null
  connected: boolean
  pairParam: string
  bestOrder?: BestOrder | null
  onLend?: (orderId: string, source: 'offchain' | 'onchain') => Promise<void>
  isLending?: boolean
}) {
  const [amount, setAmount] = useState('')

  const estimatedYield = useMemo(() => {
    if (!amount || !bestApr || !selectedDuration) return null
    const principal = parseFloat(amount)
    if (isNaN(principal) || principal <= 0) return null
    const durationYears = selectedDuration / (365 * 86400)
    return (principal * (bestApr / 100) * durationYears).toFixed(4)
  }, [amount, bestApr, selectedDuration])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] text-dust leading-relaxed">
        Fill a borrow order from the book to earn interest. You lend {pair.base.symbol}, borrower locks {pair.quote.symbol} as collateral.
      </p>

      <AmountInput
        label="You lend"
        token={pair.base}
        value={amount}
        onChange={setAmount}
        placeholder="0.00"
      />

      {/* Market info */}
      <div className="space-y-2.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Best available APR</span>
          <span className={cn('text-sm font-mono tabular-nums', bestApr !== null ? 'text-emerald-500' : 'text-ash')}>
            {bestApr !== null ? `${bestApr.toFixed(2)}%` : '--'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Duration</span>
          <span className="text-sm font-mono tabular-nums text-chalk">
            {formatDurationLabel(selectedDuration)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Backed by</span>
          <div className="flex items-center gap-1.5">
            <TokenIcon token={pair.quote} size={16} />
            <span className="text-sm text-chalk">{pair.quote.symbol}</span>
            <span className="text-[10px] text-ash">150%+</span>
          </div>
        </div>
        {estimatedYield && (
          <div className="flex items-center justify-between pt-1 border-t border-edge/15">
            <span className="text-[11px] text-dust">Est. return</span>
            <span className="text-sm font-mono tabular-nums text-aurora">
              +{estimatedYield} {pair.base.symbol}
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      {connected ? (
        bestOrder && onLend ? (
          <Button
            variant="default"
            size="lg"
            className="w-full"
            disabled={isLendingPending}
            onClick={() => onLend(bestOrder.id, bestOrder.source)}
          >
            {isLendingPending ? 'Signing...' : `Lend at ${bestApr?.toFixed(1)}% APR`}
          </Button>
        ) : bestApr !== null ? (
          <Button variant="default" size="lg" className="w-full" asChild>
            <Link href={`/trade?pair=${pairParam}&action=lend`}>
              Lend at Best Rate
            </Link>
          </Button>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-dust mb-2">No orders available</p>
            <Link
              href={`/trade?pair=${pairParam}&action=borrow`}
              className="text-xs text-star hover:text-star-bright transition-colors"
            >
              Be the first — create a borrow order
            </Link>
          </div>
        )
      ) : (
        <Button variant="outline" size="lg" className="w-full" disabled>
          Connect Wallet
        </Button>
      )}

      {bestOrder && (
        <Link
          href={bestOrder.source === 'onchain' ? `/stela/${bestOrder.id}` : `/order/${bestOrder.id}`}
          className="text-[11px] text-center text-dust hover:text-chalk transition-colors block"
        >
          View order details
        </Link>
      )}
      <Link
        href={`/trade?pair=${pairParam}&action=lend`}
        className="text-[11px] text-center text-dust hover:text-chalk transition-colors"
      >
        Advanced options on Trade page
      </Link>
    </div>
  )
}

function BorrowTab({
  pair,
  bestApr,
  selectedDuration,
  connected,
  pairParam,
}: {
  pair: { base: TokenDisplay; quote: TokenDisplay }
  bestApr: number | null
  selectedDuration: number | null
  connected: boolean
  pairParam: string
}) {
  const [borrowAmount, setBorrowAmount] = useState('')
  const [interestApr, setInterestApr] = useState('')

  // Auto-suggest APR from market
  const suggestedApr = bestApr !== null ? bestApr.toFixed(2) : ''

  const collateralEstimate = useMemo(() => {
    if (!borrowAmount) return null
    const principal = parseFloat(borrowAmount)
    if (isNaN(principal) || principal <= 0) return null
    // Estimate 150% collateral ratio — this is a display-only estimate
    return (principal * 1.5).toFixed(4)
  }, [borrowAmount])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] text-dust leading-relaxed">
        Create a borrow order offering interest to lenders. You lock {pair.quote.symbol} as collateral and receive {pair.base.symbol}.
      </p>

      <AmountInput
        label="You borrow"
        token={pair.base}
        value={borrowAmount}
        onChange={setBorrowAmount}
        placeholder="0.00"
      />

      {/* Interest APR input */}
      <div className="rounded-lg bg-void border border-edge/20 p-3 transition-colors focus-within:border-star/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-dust uppercase tracking-wider font-medium">Interest APR you offer</span>
          {suggestedApr && (
            <button
              type="button"
              onClick={() => setInterestApr(suggestedApr)}
              className="text-[10px] text-star hover:text-star-bright transition-colors cursor-pointer"
            >
              Market: {suggestedApr}%
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={interestApr}
            onChange={(e) => setInterestApr(e.target.value)}
            placeholder={suggestedApr || '0.00'}
            className="flex-1 bg-transparent text-lg font-mono text-chalk placeholder:text-ash/40 outline-none min-w-0"
          />
          <span className="text-sm text-dust shrink-0">% APR</span>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-2.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Duration</span>
          <span className="text-sm font-mono tabular-nums text-chalk">
            {formatDurationLabel(selectedDuration)}
          </span>
        </div>
        {collateralEstimate && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-dust">Est. collateral needed</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono tabular-nums text-chalk">~{collateralEstimate}</span>
              <TokenIcon token={pair.quote} size={14} />
              <span className="text-[11px] text-dust">{pair.quote.symbol}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action */}
      {connected ? (
        <Button variant="accent" size="lg" className="w-full" asChild>
          <Link href={`/trade?pair=${pairParam}&action=borrow`}>
            Create Borrow Order
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="lg" className="w-full" disabled>
          Connect Wallet
        </Button>
      )}

      <Link
        href={`/trade?pair=${pairParam}&action=borrow`}
        className="text-[11px] text-center text-dust hover:text-chalk transition-colors"
      >
        Advanced options on Trade page
      </Link>
    </div>
  )
}

function SwapTab({
  pair,
  bestRate,
  connected,
  pairParam,
}: {
  pair: { base: TokenDisplay; quote: TokenDisplay }
  bestRate: number | null
  connected: boolean
  pairParam: string
}) {
  const [sellAmount, setSellAmount] = useState('')

  const buyEstimate = useMemo(() => {
    if (!sellAmount || !bestRate) return ''
    const sell = parseFloat(sellAmount)
    if (isNaN(sell) || sell <= 0) return ''
    return (sell * bestRate).toFixed(4)
  }, [sellAmount, bestRate])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] text-dust leading-relaxed">
        Instant swap with no duration. Trade {pair.base.symbol} for {pair.quote.symbol} peer-to-peer.
      </p>

      {/* Sell side */}
      <AmountInput
        label="Sell"
        token={pair.base}
        value={sellAmount}
        onChange={setSellAmount}
        placeholder="0.00"
      />

      {/* Arrow divider */}
      <div className="flex items-center justify-center -my-1">
        <div className="w-8 h-8 rounded-lg bg-surface border border-edge/30 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dust">
            <path d="M7 3v8M4 8l3 3 3-3" />
          </svg>
        </div>
      </div>

      {/* Buy side */}
      <AmountInput
        label="Buy"
        token={pair.quote}
        value={buyEstimate}
        readOnly
        placeholder="0.00"
      />

      {/* Info rows */}
      <div className="space-y-2.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Best rate</span>
          <span className={cn('text-sm font-mono tabular-nums', bestRate !== null ? 'text-chalk' : 'text-ash')}>
            {bestRate !== null ? `1 ${pair.base.symbol} = ${bestRate.toFixed(6)} ${pair.quote.symbol}` : '--'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dust">Fee</span>
          <span className="text-sm font-mono tabular-nums text-dust">
            15 BPS (0.15%)
          </span>
        </div>
      </div>

      {/* Action */}
      {connected ? (
        bestRate !== null ? (
          <Button variant="default" size="lg" className="w-full" asChild>
            <Link href={`/trade?pair=${pairParam}&action=swap`}>
              Swap at Best Rate
            </Link>
          </Button>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-dust mb-2">No swap orders available</p>
            <Link
              href={`/trade?pair=${pairParam}&action=swap`}
              className="text-xs text-star hover:text-star-bright transition-colors"
            >
              Create one on the Trade page
            </Link>
          </div>
        )
      ) : (
        <Button variant="outline" size="lg" className="w-full" disabled>
          Connect Wallet
        </Button>
      )}

      <Link
        href={`/trade?pair=${pairParam}&action=swap`}
        className="text-[11px] text-center text-dust hover:text-chalk transition-colors"
      >
        Advanced options on Trade page
      </Link>
    </div>
  )
}

export function ActionWidget({ pair, bestLendingApr, bestSwapRate, mode, selectedDuration, bestOrder, onLend, isLending: isLendingProp, activeTab: controlledTab, onTabChange }: ActionWidgetProps) {
  const { address } = useAccount()
  const connected = !!address
  const [internalTab, setInternalTab] = useState<ActionTab>(mode === 'swap' ? 'swap' : 'lend')
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab

  // Build pair param for navigation links
  const pairParam = `${pair.base.address}-${pair.quote.address}`

  const tabs: { key: ActionTab; label: string; color: string }[] = [
    { key: 'lend', label: 'Lend', color: 'emerald' },
    { key: 'borrow', label: 'Borrow', color: 'rose' },
    { key: 'swap', label: 'Swap', color: 'cosmic' },
  ]

  return (
    <div className="bg-abyss border border-edge/30 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-edge/20">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 py-3 text-sm font-medium tracking-wide transition-colors duration-100 cursor-pointer relative',
                isActive ? 'text-chalk' : 'text-ash hover:text-dust',
              )}
            >
              {tab.label}
              {/* Active indicator */}
              {isActive && (
                <span
                  className={cn(
                    'absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full',
                    tab.color === 'emerald' && 'bg-emerald-500',
                    tab.color === 'rose' && 'bg-rose-500',
                    tab.color === 'cosmic' && 'bg-cosmic',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'lend' && (
          <LendTab
            pair={pair}
            bestApr={bestLendingApr}
            selectedDuration={selectedDuration}
            connected={connected}
            pairParam={pairParam}
            bestOrder={bestOrder}
            onLend={onLend}
            isLending={isLendingProp}
          />
        )}
        {activeTab === 'borrow' && (
          <BorrowTab
            pair={pair}
            bestApr={bestLendingApr}
            selectedDuration={selectedDuration}
            connected={connected}
            pairParam={pairParam}
          />
        )}
        {activeTab === 'swap' && (
          <SwapTab
            pair={pair}
            bestRate={bestSwapRate}
            connected={connected}
            pairParam={pairParam}
          />
        )}
      </div>
    </div>
  )
}
