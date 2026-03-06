'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, toU256, getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { Asset, AssetType, TokenInfo } from '@fepvenancio/stela-sdk'
import { RpcProvider, typedData as starknetTypedData, CallData } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, NETWORK } from '@/lib/config'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar, TokenAvatarByAddress } from '@/components/TokenAvatar'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { formatTimestamp, formatDisplayAmount } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { useInstantSettle, type MatchedOrder } from '@/hooks/useInstantSettle'
import { useMatchDetection } from '@/hooks/useMatchDetection'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import { useCreateInscription } from '@/hooks/useCreateInscription'
import { useWalletSign } from '@/hooks/useWalletSign'
import { useSignOnChainMatch } from '@/hooks/useSignOnChainMatch'
import { InlineMatchList } from '@/components/InlineMatchList'
import { useMultiSettle } from '@/hooks/useMultiSettle'
import { MultiSettleProgressModal } from '@/components/MultiSettleProgressModal'
import { selectOrders } from '@/lib/multi-match'

/* ── Types ──────────────────────────────────────────────── */

type AssetRole = 'debt' | 'collateral' | 'interest'

const ROLE_META: Record<AssetRole, { label: string; short: string; color: string; bgClass: string; borderClass: string; textClass: string }> = {
  debt: {
    label: 'Borrow',
    short: 'Debt',
    color: 'nebula',
    bgClass: 'bg-nebula/10',
    borderClass: 'border-nebula/25',
    textClass: 'text-nebula',
  },
  collateral: {
    label: 'Collateral',
    short: 'Collat.',
    color: 'star',
    bgClass: 'bg-star/10',
    borderClass: 'border-star/25',
    textClass: 'text-star',
  },
  interest: {
    label: 'Interest',
    short: 'Interest',
    color: 'aurora',
    bgClass: 'bg-aurora/10',
    borderClass: 'border-aurora/25',
    textClass: 'text-aurora',
  },
}

const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']

/* ── Helpers ────────────────────────────────────────────── */

const networkTokens = getTokensForNetwork(NETWORK)

function getSelectedToken(address: string): TokenInfo | undefined {
  return networkTokens.find(
    (t) => t.addresses[NETWORK]?.toLowerCase() === address.toLowerCase(),
  )
}

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

const CUSTOM_DURATION_UNITS = [
  { label: 'Days', multiplier: 86400 },
  { label: 'Weeks', multiplier: 604800 },
  { label: 'Months', multiplier: 2592000 },
]

function formatDurationHuman(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  const days = Math.round(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''}`
}

/* ── Asset Row ──────────────────────────────────────────── */

function AssetRow({
  asset,
  role,
  onRemove,
}: {
  asset: AssetInputValue
  role: AssetRole
  onRemove: () => void
}) {
  const token = getSelectedToken(asset.asset)
  const meta = ROLE_META[role]
  const isNft = asset.asset_type === 'ERC721' || asset.asset_type === 'ERC1155'

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 border-b border-edge/20 last:border-b-0 hover:bg-surface/20 transition-colors">
      {/* Token icon + amount */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {token ? (
          <TokenAvatar token={token} size={20} />
        ) : (
          <TokenAvatarByAddress address={asset.asset} size={20} />
        )}
        <span className="text-sm text-chalk font-medium truncate">
          {isNft ? (
            <>{token?.symbol || 'NFT'} #{asset.token_id}</>
          ) : (
            <>{formatDisplayAmount(asset.value || '0')} <span className="text-dust">{token?.symbol || formatAddress(asset.asset)}</span></>
          )}
        </span>
      </div>

      {/* Role badge */}
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.bgClass} ${meta.textClass} shrink-0`}>
        {meta.short}
      </span>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="w-6 h-6 rounded-md flex items-center justify-center text-ash hover:text-nova hover:bg-nova/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Remove asset"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  )
}

/* ── Add Asset Modal ────────────────────────────────────── */

function AddAssetModal({
  open,
  onOpenChange,
  onAdd,
  balances,
  availableRoles = ROLES,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (asset: AssetInputValue, role: AssetRole) => void
  balances?: Map<string, bigint>
  availableRoles?: AssetRole[]
}) {
  const [step, setStep] = useState<'token' | 'configure'>('token')
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('ERC20')
  const [amount, setAmount] = useState('')
  const [tokenId, setTokenId] = useState('0')
  const [role, setRole] = useState<AssetRole>('debt')
  const transitionRef = useRef(false)

  const isNft = assetType === 'ERC721' || assetType === 'ERC1155'
  const address = selectedToken?.addresses[NETWORK] ?? customAddress

  const reset = useCallback(() => {
    setStep('token')
    setSelectedToken(null)
    setIsCustom(false)
    setCustomAddress('')
    setAssetType('ERC20')
    setAmount('')
    setTokenId('0')
    setRole('debt')
  }, [])

  function handleTokenSelect(token: TokenInfo) {
    transitionRef.current = true
    setSelectedToken(token)
    setIsCustom(false)
    setAssetType('ERC20')
    setStep('configure')
  }

  function handleCustomSelect() {
    transitionRef.current = true
    setSelectedToken(null)
    setIsCustom(true)
    setStep('configure')
  }

  function handleAdd() {
    const asset: AssetInputValue = {
      asset: address,
      asset_type: assetType,
      value: isNft ? '0' : amount,
      token_id: tokenId,
      decimals: selectedToken?.decimals ?? 18,
    }
    onAdd(asset, role)
    reset()
    onOpenChange(false)
  }

  const canAdd = address && (isNft ? tokenId !== '' : amount !== '' && parseFloat(amount) > 0)

  return (
    <>
      {/* Step 1: Token selection */}
      <TokenSelectorModal
        open={open && step === 'token'}
        onOpenChange={(o) => {
          if (!o) {
            if (transitionRef.current) {
              transitionRef.current = false
              return
            }
            reset()
            onOpenChange(false)
          }
        }}
        onSelect={handleTokenSelect}
        showCustomOption={true}
        onCustomSelect={handleCustomSelect}
        balances={balances}
      />

      {/* Step 2: Configure amount + role */}
      <Dialog
        open={open && step === 'configure'}
        onOpenChange={(o) => {
          if (!o) {
            reset()
            onOpenChange(false)
          }
        }}
      >
        <DialogContent className="bg-abyss border-edge text-chalk p-0 gap-0 max-w-sm overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-chalk text-base font-semibold flex items-center gap-2.5">
              {selectedToken ? (
                <>
                  <TokenAvatar token={selectedToken} size={24} />
                  {selectedToken.symbol}
                </>
              ) : (
                'Custom Token'
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Custom address input */}
            {isCustom && (
              <div className="space-y-2">
                <Label className="text-[10px] text-dust uppercase tracking-widest font-bold">Contract Address</Label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="flex gap-1.5 pt-1">
                  {(['ERC20', 'ERC721', 'ERC1155', 'ERC4626'] as AssetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAssetType(t)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                        assetType === t
                          ? 'border-star/40 bg-star/10 text-star'
                          : 'border-edge text-ash hover:text-chalk hover:border-edge-bright'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount / Token ID */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-dust uppercase tracking-widest font-bold">
                {isNft ? 'Token ID' : 'Amount'}
              </Label>
              {isNft ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter token ID"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  className="font-mono"
                />
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || /^\d*\.?\d{0,3}$/.test(raw)) setAmount(raw)
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text')
                      if (!/^\d*\.?\d{0,3}$/.test(text)) e.preventDefault()
                    }}
                    className={`text-lg font-mono h-12 ${selectedToken ? 'pr-16' : ''}`}
                    autoFocus
                  />
                  {selectedToken && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-dust font-mono pointer-events-none">
                      {selectedToken.symbol}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest font-bold">Role</Label>
              <div className={`grid gap-1.5 ${availableRoles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {availableRoles.map((r) => {
                  const meta = ROLE_META[r]
                  const selected = role === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? `${meta.borderClass} ${meta.bgClass} ${meta.textClass}`
                          : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                      }`}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              variant="gold"
              className="w-full"
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Add {ROLE_META[role].label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function CreatePage() {
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  /* ── Form State ────────────────────────────────────────── */

  const [orderType, setOrderType] = useState<'lending' | 'swap'>('lending')
  const [mode, setMode] = useState<'offchain' | 'onchain'>('offchain')
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([])

  // Duration
  const [durationPreset, setDurationPreset] = useState('86400')
  const [customDurationValue, setCustomDurationValue] = useState('')
  const [customDurationUnit, setCustomDurationUnit] = useState(86400)
  const [useCustomDuration, setUseCustomDuration] = useState(false)

  const duration = useMemo(() => {
    if (orderType === 'swap') return '0'
    if (useCustomDuration && customDurationValue) {
      const parsed = parseFloat(customDurationValue)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return String(Math.round(parsed * customDurationUnit))
      }
    }
    return durationPreset
  }, [orderType, durationPreset, customDurationValue, customDurationUnit, useCustomDuration])

  // Deadline
  const [deadlinePreset, setDeadlinePreset] = useState('604800')
  const deadline = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    return (now + Number(deadlinePreset)).toString()
  }, [deadlinePreset])

  const [showErrors, setShowErrors] = useState(false)
  const { balances } = useTokenBalances()
  const [addModalOpen, setAddModalOpen] = useState(false)

  const createProgress = useTransactionProgress([
    { label: 'Approving collateral', description: 'Confirm token approvals in your wallet' },
    { label: 'Signing order', description: 'Sign the SNIP-12 typed data (no gas)' },
    { label: 'Submitting order', description: 'Recording your order on the network' },
  ])

  // Match detection
  const { offchainMatches, onchainMatches, isChecking, checkForMatches, hasMatches, reset: resetMatches } = useMatchDetection()
  const [matchesVisible, setMatchesVisible] = useState(false)
  const [matchSkipped, setMatchSkipped] = useState(false)

  // Instant settle (off-chain matches)
  const { settle: instantSettle, isPending: isSettling } = useInstantSettle()
  const settleProgress = useTransactionProgress([
    { label: 'Signing lend offer', description: 'Sign the SNIP-12 typed data (no gas)' },
    { label: 'Settling on-chain', description: 'Approve tokens & execute settlement' },
    { label: 'Confirming', description: 'Waiting for block confirmation' },
    { label: 'Recording', description: 'Saving settlement details' },
  ])

  // On-chain inscription creation
  const { createInscription, isPending: isCreatingOnChain } = useCreateInscription()
  const onchainProgress = useTransactionProgress([
    { label: 'Confirm in wallet', description: 'Approve collateral + create inscription' },
    { label: 'Confirming on-chain', description: 'Waiting for block confirmation' },
  ])

  // Multi-settle (aggregate swaps)
  const { settleMultiple, state: multiSettleState, reset: resetMultiSettle } = useMultiSettle()
  const [multiSettleModalOpen, setMultiSettleModalOpen] = useState(false)

  // On-chain match settlement
  const { signOnChainMatch: settleOnChainMatch, isPending: isSettlingOnChain } = useSignOnChainMatch()
  const onchainSettleProgress = useTransactionProgress([
    { label: 'Signing lend offer', description: 'Sign the transaction in your wallet' },
    { label: 'Settling on-chain', description: 'Approve tokens & execute settlement' },
    { label: 'Confirming', description: 'Waiting for block confirmation' },
  ])

  /** Close any lingering progress modal before starting a new flow */
  const closeAllProgress = useCallback(() => {
    createProgress.close()
    settleProgress.close()
    onchainProgress.close()
    onchainSettleProgress.close()
    setMultiSettleModalOpen(false)
    resetMultiSettle()
  }, [createProgress, settleProgress, onchainProgress, onchainSettleProgress, resetMultiSettle])

  /* ── Derived State ─────────────────────────────────────── */

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isSwap = orderType === 'swap'
  const isValid = hasDebt && hasCollateral && (isSwap || hasDuration)

  const submitButtonText = useMemo(() => {
    const showingMatches = matchesVisible && hasMatches && !matchSkipped
    if (showingMatches) {
      if (mode === 'offchain') {
        return isSwap ? 'Skip Matches — Create Swap' : 'Skip Matches — Create Order'
      }
      return isSwap ? 'Skip Matches — Create On-Chain Swap' : 'Skip Matches — Create Inscription'
    }
    if (mode === 'offchain') {
      return isSwap ? 'Sign & Create Swap' : 'Sign & Create Order'
    }
    return isSwap ? 'Create On-Chain Swap' : 'Create On-Chain Inscription'
  }, [mode, isSwap, matchesVisible, hasMatches, matchSkipped])

  const allAssets = useMemo(() => {
    const items: { asset: AssetInputValue; role: AssetRole; index: number }[] = []
    debtAssets.forEach((a, i) => { if (a.asset) items.push({ asset: a, role: 'debt', index: i }) })
    collateralAssets.forEach((a, i) => { if (a.asset) items.push({ asset: a, role: 'collateral', index: i }) })
    if (!isSwap) {
      interestAssets.forEach((a, i) => { if (a.asset) items.push({ asset: a, role: 'interest', index: i }) })
    }
    return items
  }, [debtAssets, collateralAssets, interestAssets, isSwap])

  // ROI Math
  const roiInfo = useMemo(() => {
    const debt = debtAssets.filter((a) => a.asset && a.asset_type === 'ERC20')
    const interest = interestAssets.filter((a) => a.asset && a.asset_type === 'ERC20')
    if (debt.length === 1 && interest.length === 1) {
      const debtToken = findTokenByAddress(debt[0].asset)
      const intToken = findTokenByAddress(interest[0].asset)
      if (!debtToken || !intToken || debtToken.symbol !== intToken.symbol) return null
      const dVal = debt[0].value ? parseAmount(debt[0].value, debt[0].decimals) : 0n
      const iVal = interest[0].value ? parseAmount(interest[0].value, interest[0].decimals) : 0n
      if (dVal > 0n) {
        const yieldPctBig = (iVal * 10000n) / dVal
        const yieldPct = Number(yieldPctBig) / 100
        return { yieldPct: yieldPct.toFixed(2), symbol: debtToken.symbol }
      }
    }
    return null
  }, [debtAssets, interestAssets])

  // Multi-settle selection
  const userGiveAmount = useMemo(() => {
    if (!isSwap || collateralAssets.length !== 1 || !collateralAssets[0].asset) return 0n
    const a = collateralAssets[0]
    return a.value ? parseAmount(a.value, a.decimals) : 0n
  }, [isSwap, collateralAssets])

  const multiSettleSelection = useMemo(() => {
    const totalMatches = offchainMatches.length + onchainMatches.length
    if (!isSwap || totalMatches < 2 || userGiveAmount <= 0n) return null
    return selectOrders(offchainMatches, onchainMatches, userGiveAmount)
  }, [isSwap, offchainMatches, onchainMatches, userGiveAmount])

  const giveSymbol = useMemo(() => {
    if (collateralAssets.length !== 1 || !collateralAssets[0].asset) return undefined
    return findTokenByAddress(collateralAssets[0].asset)?.symbol
  }, [collateralAssets])

  const receiveSymbol = useMemo(() => {
    if (debtAssets.length !== 1 || !debtAssets[0].asset) return undefined
    return findTokenByAddress(debtAssets[0].asset)?.symbol
  }, [debtAssets])

  /* ── Debounced Match Detection ─────────────────────────── */

  const filteredDebtForMatch = useMemo(() => debtAssets.filter(a => a.asset), [debtAssets])
  const filteredCollateralForMatch = useMemo(() => collateralAssets.filter(a => a.asset), [collateralAssets])

  useEffect(() => {
    setMatchesVisible(false)
    setMatchSkipped(false)

    if (!address) return
    if (filteredDebtForMatch.length !== 1 || filteredCollateralForMatch.length !== 1) return
    if (multiLender) return

    const debtToken = filteredDebtForMatch[0].asset
    const collateralToken = filteredCollateralForMatch[0].asset
    if (!debtToken || !collateralToken) return

    const timer = setTimeout(() => {
      checkForMatches({
        debtToken,
        collateralToken,
        duration: duration || '0',
        borrowerAddress: address,
      })
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDebtForMatch, filteredCollateralForMatch, duration, address, multiLender])

  useEffect(() => {
    if (hasMatches && !matchSkipped) {
      setMatchesVisible(true)
    }
  }, [hasMatches, matchSkipped])

  /* ── Add Asset Handler ─────────────────────────────────── */

  const handleAddAsset = useCallback((asset: AssetInputValue, role: AssetRole) => {
    switch (role) {
      case 'debt':
        setDebtAssets((prev) => [...prev, asset])
        break
      case 'collateral':
        setCollateralAssets((prev) => [...prev, asset])
        break
      case 'interest':
        setInterestAssets((prev) => [...prev, asset])
        break
    }
  }, [])

  const handleRemoveAsset = useCallback((role: AssetRole, index: number) => {
    switch (role) {
      case 'debt':
        setDebtAssets((prev) => prev.filter((_, j) => j !== index))
        break
      case 'collateral':
        setCollateralAssets((prev) => prev.filter((_, j) => j !== index))
        break
      case 'interest':
        setInterestAssets((prev) => prev.filter((_, j) => j !== index))
        break
    }
  }, [])

  /* ── Submit ──────────────────────────────────────────── */

  const toSdkAssets = useCallback((inputs: AssetInputValue[]): Asset[] =>
    inputs
      .filter((a) => {
        if (!a.asset) return false
        if (a.asset_type === 'ERC721' || a.asset_type === 'ERC1155') return true
        const raw = a.value ? parseAmount(a.value, a.decimals) : 0n
        return raw > 0n
      })
      .map((a) => ({
        asset_address: a.asset,
        asset_type: a.asset_type as AssetType,
        value:
          a.asset_type === 'ERC721'
            ? 0n
            : a.value
              ? parseAmount(a.value, a.decimals)
              : 0n,
        token_id: BigInt(a.token_id || '0'),
      })),
  [])

  function resetForm() {
    setOrderType('lending')
    setDebtAssets([])
    setInterestAssets([])
    setCollateralAssets([])
    setDurationPreset('86400')
    setCustomDurationValue('')
    setCustomDurationUnit(86400)
    setUseCustomDuration(false)
    setDeadlinePreset('604800')
    setMultiLender(false)
    setShowErrors(false)
    setMatchesVisible(false)
    setMatchSkipped(false)
    resetMatches()
  }

  async function handleSubmit() {
    if (!address || !account) return
    setShowErrors(true)
    if (!isValid) return

    if (matchesVisible && hasMatches && !matchSkipped) {
      return
    }

    if (mode === 'offchain') {
      await createOrder()
    } else {
      await createOnChainInscription()
    }
  }

  async function handleInstantSettle(match: MatchedOrder) {
    closeAllProgress()
    try {
      await instantSettle(match, settleProgress)
      resetForm()
    } catch {
      // Error already toasted in hook
    }
  }

  async function handleOnchainSettle(match: OnChainMatch) {
    closeAllProgress()
    try {
      const debtAssetInfos = (match.debtAssets ?? []).map(a => ({
        address: a.asset_address,
        value: a.value,
      }))
      await settleOnChainMatch(match.id, debtAssetInfos, 10000, onchainSettleProgress)
      resetForm()
    } catch {
      // Error already toasted in hook
    }
  }

  async function handleMultiSettle() {
    if (!multiSettleSelection || multiSettleSelection.selected.length < 2) return
    closeAllProgress()
    setMultiSettleModalOpen(true)
    try {
      await settleMultiple(multiSettleSelection.selected)
      resetForm()
    } catch {
      // Error already toasted in hook
    }
  }

  async function createOnChainInscription() {
    if (!address || !account) return
    closeAllProgress()

    const sdkDebtAssets = toSdkAssets(debtAssets)
    const sdkInterestAssets = toSdkAssets(interestAssets)
    const sdkCollateralAssets = toSdkAssets(collateralAssets)

    setIsPending(true)
    try {
      await createInscription({
        isBorrow: true,
        debtAssets: sdkDebtAssets,
        interestAssets: sdkInterestAssets,
        collateralAssets: sdkCollateralAssets,
        duration: BigInt(duration || '0'),
        deadline: BigInt(deadline || '0'),
        multiLender,
      }, onchainProgress)
      toast.success(isSwap ? 'On-chain swap created!' : 'On-chain inscription created!', {
        description: 'Your collateral has been locked on-chain.',
      })
      resetForm()
    } catch (err: unknown) {
      onchainProgress.fail(getErrorMessage(err))
      toast.error('Failed to create inscription', { description: getErrorMessage(err) })
    } finally {
      setIsPending(false)
    }
  }

  async function createOrder() {
    if (!address || !account) return
    closeAllProgress()

    const sdkDebtAssets = toSdkAssets(debtAssets)
    const sdkInterestAssets = toSdkAssets(interestAssets)
    const sdkCollateralAssets = toSdkAssets(collateralAssets)

    setIsPending(true)
    createProgress.start()
    try {
      const erc20Collateral = sdkCollateralAssets.filter(a => a.asset_type === 'ERC20' || a.asset_type === 'ERC4626')
      const nftCollateral = sdkCollateralAssets.filter(a => a.asset_type === 'ERC721' || a.asset_type === 'ERC1155')

      const pendingApprovals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []

      if (erc20Collateral.length > 0) {
        const checks = await Promise.all(
          erc20Collateral.map(async (asset) => {
            try {
              const result = await provider.callContract({
                contractAddress: asset.asset_address,
                entrypoint: 'allowance',
                calldata: CallData.compile({ owner: address, spender: CONTRACT_ADDRESS }),
              })
              const currentAllowance = BigInt(result[0])
              return { asset, sufficient: currentAllowance >= asset.value }
            } catch {
              return { asset, sufficient: false }
            }
          }),
        )
        for (const { asset, sufficient } of checks) {
          if (!sufficient) {
            pendingApprovals.push({
              contractAddress: asset.asset_address,
              entrypoint: 'approve',
              calldata: [CONTRACT_ADDRESS, ...toU256(asset.value)],
            })
          }
        }
      }

      if (nftCollateral.length > 0) {
        const checks = await Promise.all(
          nftCollateral.map(async (asset) => {
            try {
              const result = await provider.callContract({
                contractAddress: asset.asset_address,
                entrypoint: 'is_approved_for_all',
                calldata: CallData.compile({ owner: address, operator: CONTRACT_ADDRESS }),
              })
              return { asset, approved: BigInt(result[0]) !== 0n }
            } catch {
              return { asset, approved: false }
            }
          }),
        )
        for (const { asset, approved } of checks) {
          if (!approved) {
            pendingApprovals.push({
              contractAddress: asset.asset_address,
              entrypoint: 'set_approval_for_all',
              calldata: [CONTRACT_ADDRESS, '1'],
            })
          }
        }
      }

      if (pendingApprovals.length > 0) {
        toast.info('Approve collateral in your wallet...')
        const { transaction_hash: approvalTx } = await account.execute(pendingApprovals)
        createProgress.setTxHash(approvalTx)
        await provider.waitForTransaction(approvalTx)
        toast.success('Collateral approved!')
      }
      createProgress.advance()

      const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

      const typedData = getInscriptionOrderTypedData({
        borrower: address,
        debtAssets: sdkDebtAssets,
        interestAssets: sdkInterestAssets,
        collateralAssets: sdkCollateralAssets,
        debtCount: sdkDebtAssets.length,
        interestCount: sdkInterestAssets.length,
        collateralCount: sdkCollateralAssets.length,
        duration: BigInt(duration || '0'),
        deadline: BigInt(deadline || '0'),
        multiLender: multiLender,
        nonce,
        chainId: CHAIN_ID,
      })

      const orderMessageHash = starknetTypedData.getMessageHash(typedData, address)
      const signature = await signTypedData(typedData)
      const orderId = crypto.randomUUID()

      const orderData = {
        borrower: address,
        debtAssets: sdkDebtAssets.map(a => ({
          asset_address: a.asset_address,
          asset_type: a.asset_type,
          value: a.value.toString(),
          token_id: a.token_id.toString(),
        })),
        interestAssets: sdkInterestAssets.map(a => ({
          asset_address: a.asset_address,
          asset_type: a.asset_type,
          value: a.value.toString(),
          token_id: a.token_id.toString(),
        })),
        collateralAssets: sdkCollateralAssets.map(a => ({
          asset_address: a.asset_address,
          asset_type: a.asset_type,
          value: a.value.toString(),
          token_id: a.token_id.toString(),
        })),
        duration: duration,
        deadline: deadline,
        multiLender: multiLender,
        nonce: nonce.toString(),
        orderHash: orderMessageHash,
        debtHash: hashAssets(sdkDebtAssets),
        interestHash: hashAssets(sdkInterestAssets),
        collateralHash: hashAssets(sdkCollateralAssets),
      }

      createProgress.advance()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          borrower: address,
          order_data: orderData,
          borrower_signature: signature.map(String),
          nonce: nonce.toString(),
          deadline: Number(deadline),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error((err as Record<string, string>).error || 'Failed to create order')
      }

      createProgress.advance()
      toast.success('Order signed & submitted', {
        description: 'Your inscription order is now live. No gas was spent!',
      })
      resetForm()
    } catch (err: unknown) {
      createProgress.fail(getErrorMessage(err))
      toast.error('Failed to sign order', { description: getErrorMessage(err) })
    } finally {
      setIsPending(false)
    }
  }

  /* ── Render ────────────────────────────────────────────── */

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
      active
        ? 'bg-star/15 text-star border border-star/30'
        : 'text-dust border border-transparent hover:text-chalk hover:bg-surface/50'
    }`

  return (
    <div className="animate-fade-up max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl tracking-widest text-chalk mb-1 uppercase">
          Inscribe
        </h1>
        <p className="text-dust text-sm">
          {mode === 'offchain' ? 'Gasless signing — no cost until settlement.' : 'Collateral locked on-chain immediately.'}
        </p>
      </div>

      <div className="space-y-4">

        {/* ── TOGGLES — single compact row ──────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Order type */}
          <button type="button" onClick={() => { setOrderType('lending'); if (durationPreset === '0') setDurationPreset('86400') }} className={pillClass(orderType === 'lending')}>
            Lending
          </button>
          <button type="button" onClick={() => { setOrderType('swap'); setInterestAssets([]); setUseCustomDuration(false) }} className={pillClass(orderType === 'swap')}>
            Swap
          </button>

          <div className="w-px h-4 bg-edge/40 mx-1" />

          {/* Mode */}
          <button type="button" onClick={() => setMode('offchain')} className={pillClass(mode === 'offchain')}>
            Off-Chain
          </button>
          <button type="button" onClick={() => setMode('onchain')} className={pillClass(mode === 'onchain')}>
            On-Chain
          </button>

          <div className="w-px h-4 bg-edge/40 mx-1" />

          {/* Lender mode */}
          <button type="button" onClick={() => setMultiLender(false)} className={pillClass(!multiLender)}>
            Single
          </button>
          <button type="button" onClick={() => setMultiLender(true)} className={pillClass(multiLender)}>
            Multi
          </button>
        </div>

        {/* ── ASSETS + TERMS (single card) ──────────────── */}
        <section className="rounded-xl border border-edge/30 overflow-clip">
          {/* Asset header + add */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge/30 bg-surface/10">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold">
              Assets{allAssets.length > 0 && <span className="ml-1 text-chalk">{allAssets.length}</span>}
            </span>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1 text-[11px] text-star hover:text-star-bright transition-colors font-medium cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
              Add
            </button>
          </div>

          {/* Asset list */}
          {allAssets.length === 0 ? (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="w-full py-8 hover:bg-surface/10 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash"><path d="M8 3v10M3 8h10" /></svg>
                <span className="text-xs text-dust">Add tokens</span>
              </div>
            </button>
          ) : (
            <div>
              {allAssets.map((item) => (
                <AssetRow
                  key={`${item.role}-${item.asset.asset}-${item.asset.token_id}`}
                  asset={item.asset}
                  role={item.role}
                  onRemove={() => handleRemoveAsset(item.role, item.index)}
                />
              ))}
            </div>
          )}

          {showErrors && (!hasDebt || !hasCollateral) && (
            <div className="px-3 py-1.5 border-t border-edge/20 bg-nova/5">
              <p className="text-[11px] text-nova">
                {!hasDebt && 'Add at least one borrow asset. '}
                {!hasCollateral && 'Add at least one collateral asset.'}
              </p>
            </div>
          )}

          {/* Terms — inline inside the same card */}
          <div className="px-3 py-3 border-t border-edge/20 space-y-3">
            {/* Duration (lending only) */}
            {!isSwap && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Duration</span>
                  {useCustomDuration ? (
                    <button type="button" onClick={() => setUseCustomDuration(false)} className="text-[10px] text-star hover:text-star-bright transition-colors cursor-pointer">Presets</button>
                  ) : (
                    <button type="button" onClick={() => setUseCustomDuration(true)} className="text-[10px] text-ash hover:text-star transition-colors cursor-pointer">Custom</button>
                  )}
                </div>
                {useCustomDuration ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={customDurationValue}
                      onChange={(e) => setCustomDurationValue(e.target.value)}
                      className="flex-1 bg-surface/50 border-edge/50 font-mono h-8 text-sm"
                      placeholder="Amount"
                      min="1"
                    />
                    <div className="flex gap-1">
                      {CUSTOM_DURATION_UNITS.map((u) => (
                        <button
                          key={u.multiplier}
                          type="button"
                          onClick={() => setCustomDurationUnit(u.multiplier)}
                          className={`px-2 py-1 rounded-lg text-[10px] border transition-all cursor-pointer ${
                            customDurationUnit === u.multiplier ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk'
                          }`}
                        >{u.label}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.seconds}
                        type="button"
                        onClick={() => setDurationPreset(p.seconds.toString())}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                          durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star font-medium' : 'border-edge/50 text-dust hover:text-chalk'
                        }`}
                      >{p.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Deadline */}
            <div>
              <span className="text-[10px] text-dust uppercase tracking-widest font-bold block mb-1.5">Expires in</span>
              <div className="flex flex-wrap gap-1.5">
                {DEADLINE_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => setDeadlinePreset(p.seconds.toString())}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                      deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star font-medium' : 'border-edge/50 text-dust hover:text-chalk'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary bar — thin inline strip */}
          {allAssets.length > 0 && (
            <div className="px-3 py-2 border-t border-edge/20 bg-surface/5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                {isSwap ? (
                  <span className="text-aurora font-medium">Swap</span>
                ) : (
                  <span className="text-dust">Duration: <span className="text-chalk font-medium">{formatDurationHuman(Number(duration))}</span></span>
                )}
                <span className="text-dust">Expires: <span className="text-chalk font-medium">{formatTimestamp(BigInt(deadline))}</span></span>
                <span className="text-dust">Mode: <span className={`font-medium ${mode === 'onchain' ? 'text-star' : 'text-chalk'}`}>{mode === 'offchain' ? 'Gasless' : 'On-Chain'}</span></span>
                {roiInfo && (
                  <span className="text-dust">Yield: <span className="text-aurora font-medium">+{roiInfo.yieldPct}%</span></span>
                )}
                {isSwap && <span className="text-dust/60">0.10% fee</span>}
              </div>
            </div>
          )}
        </section>

        {/* ── MATCHED STELAS — table list ───────────────── */}
        {matchesVisible && !matchSkipped && hasMatches && (
          <InlineMatchList
            offchainMatches={offchainMatches}
            onchainMatches={onchainMatches}
            isSwap={isSwap}
            onSettleOffchain={handleInstantSettle}
            onSettleOnchain={handleOnchainSettle}
            onSettleMultiple={handleMultiSettle}
            onSkip={() => {
              setMatchSkipped(true)
              setMatchesVisible(false)
            }}
            isSettling={isSettling || isSettlingOnChain || multiSettleState.phase !== 'idle'}
            multiSettleSelection={multiSettleSelection}
            giveSymbol={giveSymbol}
            receiveSymbol={receiveSymbol}
          />
        )}

        {/* ── SUBMIT ────────────────────────────────────── */}
        <Web3ActionWrapper message="Connect your wallet to create an inscription">
          <Button
            variant="gold"
            size="lg"
            className="w-full h-12 uppercase tracking-widest"
            onClick={handleSubmit}
            disabled={isPending || isCreatingOnChain || isChecking}
          >
            {isPending || isCreatingOnChain ? 'Processing...' : isChecking ? 'Checking matches...' : submitButtonText}
          </Button>
        </Web3ActionWrapper>
      </div>

      {/* Modals */}
      <AddAssetModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={handleAddAsset}
        balances={balances}
        availableRoles={isSwap ? (['debt', 'collateral'] as AssetRole[]) : ROLES}
      />

      {(() => {
        const active = [createProgress, settleProgress, onchainProgress, onchainSettleProgress].find(p => p.open)
        return active ? (
          <TransactionProgressModal
            open
            steps={active.steps}
            txHash={active.txHash}
            onClose={active.close}
          />
        ) : null
      })()}

      <MultiSettleProgressModal
        open={multiSettleModalOpen && multiSettleState.phase !== 'idle'}
        state={multiSettleState}
        onClose={() => {
          setMultiSettleModalOpen(false)
          resetMultiSettle()
        }}
      />
    </div>
  )
}
