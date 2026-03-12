'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider } from 'starknet'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { NETWORK, CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import { useRefinance } from '@/hooks/useRefinance'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import { formatTokenValue } from '@/lib/format'

/* ── Constants ──────────────────────────────────────────── */

const DURATION_PRESETS = [
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '90d', seconds: 7776000 },
  { label: '180d', seconds: 15552000 },
  { label: '1y', seconds: 31536000 },
]

const DEADLINE_PRESETS = [
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '60d', seconds: 5184000 },
  { label: '90d', seconds: 7776000 },
]

/* ── Spinner ─────────────────────────────────────────────── */

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/* ── Token Input Box ─────────────────────────────────────── */

interface TokenBoxProps {
  label: string
  accentClass: string
  borderClass: string
  bgClass: string
  tokenAddress: string
  amount: string
  balance?: bigint
  onTokenClick: () => void
  onAmountChange: (val: string) => void
  onMaxClick?: () => void
}

function TokenBox({
  label, accentClass, borderClass, bgClass,
  tokenAddress, amount, balance,
  onTokenClick, onAmountChange, onMaxClick,
}: TokenBoxProps) {
  const token = tokenAddress ? findTokenByAddress(tokenAddress) : null

  return (
    <div className={`${bgClass} border ${borderClass} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accentClass}`}>{label}</span>
        {token && balance !== undefined && balance > 0n && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-dust font-mono">
              {formatTokenValue(balance.toString(), token.decimals)}
            </span>
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-[10px] text-star hover:text-star-bright font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTokenClick}
          className="flex items-center gap-2 h-10 px-3 rounded-md bg-surface/60 border border-edge/40 text-sm transition-colors hover:bg-elevated hover:border-edge-bright cursor-pointer shrink-0"
        >
          {token ? (
            <>
              <TokenAvatar token={token} size={20} />
              <span className="text-chalk font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-dust">Select</span>
          )}
          <svg className="text-ash ml-1" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || /^\d*\.?\d{0,18}$/.test(raw)) onAmountChange(raw)
          }}
          className="flex-1 text-right text-xl font-mono bg-transparent outline-none text-chalk placeholder:text-ash/40"
        />
      </div>
    </div>
  )
}

/* ── Preset Selector ─────────────────────────────────────── */

function PresetSelector({
  label,
  presets,
  selected,
  onSelect,
}: {
  label: string
  presets: { label: string; seconds: number }[]
  selected: string
  onSelect: (val: string) => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] text-dust uppercase tracking-widest font-bold shrink-0 w-16">{label}</span>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.seconds}
            type="button"
            onClick={() => onSelect(p.seconds.toString())}
            className={`py-1 px-2 rounded-sm text-[10px] border transition-colors cursor-pointer font-medium ${
              selected === p.seconds.toString()
                ? 'border-star/40 bg-star/10 text-star'
                : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Main Form Component ─────────────────────────────────── */

interface RefinanceOfferFormProps {
  inscriptionId: string
  onClose: () => void
}

export function RefinanceOfferForm({ inscriptionId, onClose }: RefinanceOfferFormProps) {
  const { address } = useAccount()
  const { createOffer, isPending } = useRefinance()
  const { balances } = useTokenBalances()

  const [debtToken, setDebtToken] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtDecimals, setDebtDecimals] = useState(18)

  const [interestToken, setInterestToken] = useState('')
  const [interestAmount, setInterestAmount] = useState('')
  const [interestDecimals, setInterestDecimals] = useState(18)

  const [durationPreset, setDurationPreset] = useState('86400')
  const [deadlinePreset, setDeadlinePreset] = useState('604800')
  const [openSelector, setOpenSelector] = useState<'debt' | 'interest' | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  const debtBalance = debtToken ? balances.get(debtToken.toLowerCase()) : undefined
  const interestBalance = interestToken ? balances.get(interestToken.toLowerCase()) : undefined

  const hasDebt = Boolean(debtToken && debtAmount)
  const isValid = hasDebt

  const handleTokenSelect = useCallback((slot: 'debt' | 'interest', token: TokenInfo) => {
    const addr = token.addresses[NETWORK] ?? ''
    if (slot === 'debt') {
      setDebtToken(addr)
      setDebtDecimals(token.decimals)
      setDebtAmount('')
    } else {
      setInterestToken(addr)
      setInterestDecimals(token.decimals)
      setInterestAmount('')
    }
    setOpenSelector(null)
  }, [])

  const handleMaxClick = useCallback((slot: 'debt' | 'interest') => {
    if (slot === 'debt') {
      const token = debtToken ? findTokenByAddress(debtToken) : null
      if (token && debtBalance) {
        setDebtAmount(formatTokenValue(debtBalance.toString(), token.decimals))
      }
    } else {
      const token = interestToken ? findTokenByAddress(interestToken) : null
      if (token && interestBalance) {
        setInterestAmount(formatTokenValue(interestBalance.toString(), token.decimals))
      }
    }
  }, [debtToken, debtBalance, interestToken, interestBalance])

  const handleSubmit = useCallback(async () => {
    setShowErrors(true)
    if (!isValid || !address) return

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlinePreset))
    const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

    const newDebtAssets = [{
      asset_address: debtToken,
      asset_type: 'ERC20' as const,
      value: parseAmount(debtAmount || '0', debtDecimals).toString(),
      token_id: '0',
    }]

    const newInterestAssets = interestToken && interestAmount ? [{
      asset_address: interestToken,
      asset_type: 'ERC20' as const,
      value: parseAmount(interestAmount || '0', interestDecimals).toString(),
      token_id: '0',
    }] : []

    await createOffer({
      inscriptionId,
      newDebtAssets,
      newInterestAssets,
      newDebtCount: newDebtAssets.length,
      newInterestCount: newInterestAssets.length,
      newDuration: durationPreset,
      deadline: deadline.toString(),
      nonce,
    })

    // Reset and close on success
    onClose()
  }, [
    isValid, address, deadlinePreset, durationPreset, provider,
    debtToken, debtAmount, debtDecimals,
    interestToken, interestAmount, interestDecimals,
    inscriptionId, createOffer, onClose,
  ])

  if (!address) return null

  return (
    <div className="space-y-4">
      {/* Debt Token */}
      <TokenBox
        label="New Debt"
        accentClass="text-aurora"
        borderClass="border-aurora/20"
        bgClass="bg-aurora/5"
        tokenAddress={debtToken}
        amount={debtAmount}
        balance={debtBalance}
        onTokenClick={() => setOpenSelector('debt')}
        onAmountChange={setDebtAmount}
        onMaxClick={() => handleMaxClick('debt')}
      />

      {/* Interest Token */}
      <TokenBox
        label="New Interest"
        accentClass="text-nebula"
        borderClass="border-nebula/20"
        bgClass="bg-nebula/5"
        tokenAddress={interestToken}
        amount={interestAmount}
        balance={interestBalance}
        onTokenClick={() => setOpenSelector('interest')}
        onAmountChange={setInterestAmount}
        onMaxClick={() => handleMaxClick('interest')}
      />

      {/* Validation */}
      {showErrors && !isValid && (
        <div className="px-4 py-3 rounded-lg border border-nova/20 bg-nova/5">
          <p className="text-xs text-nova font-medium">
            {!hasDebt && '-- Select a debt token and amount.'}
          </p>
        </div>
      )}

      {/* Duration & Deadline Presets */}
      <div className="rounded-lg border border-edge/30 bg-surface/5 p-4 space-y-3">
        <PresetSelector
          label="Duration"
          presets={DURATION_PRESETS}
          selected={durationPreset}
          onSelect={setDurationPreset}
        />
        <PresetSelector
          label="Expiry"
          presets={DEADLINE_PRESETS}
          selected={deadlinePreset}
          onSelect={setDeadlinePreset}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant="gold"
          className="flex-1 uppercase tracking-[0.15em] text-sm"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <div className="flex items-center gap-2">
              <Spinner />
              Signing...
            </div>
          ) : (
            'Sign & Submit Offer'
          )}
        </Button>
      </div>

      {/* Token Selector Modals */}
      <TokenSelectorModal
        open={openSelector === 'debt'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('debt', token)}
        selectedAddress={debtToken}
        showCustomOption={false}
        balances={balances}
      />
      <TokenSelectorModal
        open={openSelector === 'interest'}
        onOpenChange={(open) => { if (!open) setOpenSelector(null) }}
        onSelect={(token) => handleTokenSelect('interest', token)}
        selectedAddress={interestToken}
        showCustomOption={false}
        balances={balances}
      />
    </div>
  )
}
