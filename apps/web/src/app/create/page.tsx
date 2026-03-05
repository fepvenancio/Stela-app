'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, toU256, getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { Asset, AssetType, TokenInfo } from '@fepvenancio/stela-sdk'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, NETWORK } from '@/lib/config'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar } from '@/components/TokenAvatar'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { formatTimestamp } from '@/lib/format'
import { formatAddress } from '@/lib/address'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'

/* ── Types ──────────────────────────────────────────────── */

type AssetRole = 'debt' | 'collateral' | 'interest'

const ROLE_META: Record<AssetRole, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; description: string }> = {
  debt: {
    label: 'Borrow',
    color: 'nebula',
    bgClass: 'bg-nebula/10',
    borderClass: 'border-nebula/25',
    textClass: 'text-nebula',
    description: 'Assets you want to receive',
  },
  collateral: {
    label: 'Collateral',
    color: 'star',
    bgClass: 'bg-star/10',
    borderClass: 'border-star/25',
    textClass: 'text-star',
    description: 'Assets you lock as guarantee',
  },
  interest: {
    label: 'Interest',
    color: 'aurora',
    bgClass: 'bg-aurora/10',
    borderClass: 'border-aurora/25',
    textClass: 'text-aurora',
    description: 'Reward paid to lender',
  },
}

const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']

/* ── Helpers ────────────────────────────────────────────── */

const emptyAsset = (): AssetInputValue => ({
  asset: '',
  asset_type: 'ERC20',
  value: '',
  token_id: '0',
  decimals: 18,
})

const networkTokens = getTokensForNetwork(NETWORK)

function getSelectedToken(address: string): TokenInfo | undefined {
  return networkTokens.find(
    (t) => t.addresses[NETWORK]?.toLowerCase() === address.toLowerCase(),
  )
}

const DURATION_PRESETS = [
  { label: '1 Day', seconds: 86400 },
  { label: '7 Days', seconds: 604800 },
  { label: '14 Days', seconds: 1209600 },
  { label: '30 Days', seconds: 2592000 },
  { label: '90 Days', seconds: 7776000 },
  { label: '180 Days', seconds: 15552000 },
  { label: '1 Year', seconds: 31536000 },
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
  { label: 'Years', multiplier: 31536000 },
]

function formatDurationHuman(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  const days = Math.round(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''}`
}

/* ── Asset Pill ─────────────────────────────────────────── */

function AssetPill({
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
    <div
      className={`group flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full border ${meta.borderClass} ${meta.bgClass} transition-all hover:border-opacity-60`}
    >
      {token ? (
        <TokenAvatar token={token} size={22} />
      ) : (
        <div className="w-[22px] h-[22px] rounded-full bg-edge-bright flex items-center justify-center text-[9px] text-dust shrink-0">
          ?
        </div>
      )}
      <span className="text-xs text-chalk font-medium truncate max-w-[80px]">
        {isNft ? (
          <>{token?.symbol || 'NFT'} #{asset.token_id}</>
        ) : (
          <>{asset.value || '0'} <span className="text-dust">{token?.symbol || formatAddress(asset.asset)}</span></>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 rounded-full flex items-center justify-center text-ash hover:text-nova hover:bg-nova/15 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Remove asset"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l6 6M8 2l-6 6" />
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (asset: AssetInputValue, role: AssetRole) => void
  balances?: Map<string, bigint>
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
      {/* Step 1: Token selection — reuses existing modal */}
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
        <DialogContent className="bg-abyss border-edge text-chalk p-0 gap-0 max-w-md overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-chalk text-lg font-semibold flex items-center gap-3">
              {selectedToken ? (
                <>
                  <TokenAvatar token={selectedToken} size={28} />
                  {selectedToken.symbol}
                </>
              ) : (
                'Custom Token'
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pt-5 pb-6 space-y-5">
            {/* Custom address input */}
            {isCustom && (
              <div className="space-y-2">
                <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">Contract Address</Label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className="font-mono text-sm"
                />
                {/* Asset type selector for custom tokens */}
                <div className="flex gap-1.5 pt-1">
                  {(['ERC20', 'ERC721', 'ERC1155', 'ERC4626'] as AssetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAssetType(t)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
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
            <div className="space-y-2">
              <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
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
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || /^\d*\.?\d*$/.test(raw)) setAmount(raw)
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

            {/* Role selector — the key UX improvement */}
            <div className="space-y-2.5">
              <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">Assign Role</Label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => {
                  const meta = ROLE_META[r]
                  const selected = role === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        selected
                          ? `${meta.borderClass} ${meta.bgClass}`
                          : 'border-edge/50 hover:border-edge-bright bg-surface/30'
                      }`}
                    >
                      {selected && (
                        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-${meta.color}`} />
                      )}
                      <span className={`text-sm font-semibold ${selected ? meta.textClass : 'text-chalk'}`}>
                        {meta.label}
                      </span>
                      <span className="text-[9px] text-ash leading-tight text-center">
                        {meta.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Add button */}
            <Button
              variant="gold"
              size="lg"
              className="w-full uppercase tracking-widest"
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Add {ROLE_META[role].label} Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Asset Column ───────────────────────────────────────── */

function AssetColumn({
  role,
  assets,
  onRemove,
  required,
  showErrors,
}: {
  role: AssetRole
  assets: AssetInputValue[]
  onRemove: (index: number) => void
  required?: boolean
  showErrors?: boolean
}) {
  const meta = ROLE_META[role]
  const validAssets = assets.filter((a) => a.asset)
  const missing = required && showErrors && validAssets.length === 0

  return (
    <div className="space-y-2.5">
      {/* Column header */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full bg-${meta.color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${meta.textClass}`}>
          {meta.label}
        </span>
        {validAssets.length > 0 && (
          <span className="text-[10px] font-mono text-ash bg-surface px-1.5 py-0.5 rounded-md">
            {validAssets.length}
          </span>
        )}
        {required && <span className="text-star text-[10px]">*</span>}
      </div>

      {/* Asset pills */}
      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
        {validAssets.map((asset, i) => (
          <AssetPill key={i} asset={asset} role={role} onRemove={() => onRemove(i)} />
        ))}
        {validAssets.length === 0 && (
          <span className={`text-[11px] italic ${missing ? 'text-nova' : 'text-ash/50'}`}>
            {missing ? 'Required' : 'None added'}
          </span>
        )}
      </div>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function CreatePage() {
  const { address, account } = useAccount()
  const [isPending, setIsPending] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  /* ── Form State ────────────────────────────────────────── */

  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([])

  // Duration
  const [durationPreset, setDurationPreset] = useState('86400')
  const [customDurationValue, setCustomDurationValue] = useState('')
  const [customDurationUnit, setCustomDurationUnit] = useState(86400) // days
  const [useCustomDuration, setUseCustomDuration] = useState(false)

  const duration = useMemo(() => {
    if (useCustomDuration && customDurationValue) {
      const parsed = parseFloat(customDurationValue)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return String(Math.round(parsed * customDurationUnit))
      }
    }
    return durationPreset
  }, [durationPreset, customDurationValue, customDurationUnit, useCustomDuration])

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

  /* ── Derived State ─────────────────────────────────────── */

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isValid = hasDebt && hasCollateral && hasDuration

  const totalAssets = [
    ...debtAssets.filter((a) => a.asset),
    ...interestAssets.filter((a) => a.asset),
    ...collateralAssets.filter((a) => a.asset),
  ].length

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

  /* ── Submit (unchanged logic) ──────────────────────────── */

  async function handleSubmit() {
    if (!address || !account) return
    setShowErrors(true)
    if (!isValid) return

    const toSdkAssets = (inputs: AssetInputValue[]): Asset[] =>
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
        }))

    const sdkDebtAssets = toSdkAssets(debtAssets)
    const sdkInterestAssets = toSdkAssets(interestAssets)
    const sdkCollateralAssets = toSdkAssets(collateralAssets)

    setIsPending(true)
    createProgress.start()
    try {
      const erc20Approvals = sdkCollateralAssets
        .filter(a => a.asset_type === 'ERC20' || a.asset_type === 'ERC4626')
        .map(asset => ({
          contractAddress: asset.asset_address,
          entrypoint: 'approve',
          calldata: [CONTRACT_ADDRESS, ...toU256(asset.value)],
        }))

      const nftApprovals = sdkCollateralAssets
        .filter(a => a.asset_type === 'ERC721' || a.asset_type === 'ERC1155')
        .map(asset => ({
          contractAddress: asset.asset_address,
          entrypoint: 'set_approval_for_all',
          calldata: [CONTRACT_ADDRESS, '1'],
        }))

      const allApprovals = [...erc20Approvals, ...nftApprovals]
      if (allApprovals.length > 0) {
        toast.info('Approve collateral in your wallet...')
        const { transaction_hash: approvalTx } = await account.execute(allApprovals)
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
      const signature = await account.signMessage(typedData)
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
          borrower_signature: Array.isArray(signature)
            ? signature.map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s))
            : [signature.r, signature.s].map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s)),
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

      // Reset
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
    } catch (err: unknown) {
      createProgress.fail(getErrorMessage(err))
      toast.error('Failed to sign order', { description: getErrorMessage(err) })
    } finally {
      setIsPending(false)
    }
  }

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
          Inscribe the Stela
        </h1>
        <p className="text-dust leading-relaxed text-sm">
          Define the terms of your lending inscription. No gas until settlement.
        </p>
      </div>

      <div className="space-y-6">

        {/* ══════════════════════════════════════════════════
            SECTION 1: LOAN SETTINGS
           ══════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-star/15 border border-star/25 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star">
                <path d="M6 1v10M1 6h10" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-chalk">Loan Settings</span>
          </div>

          {/* Multi-lender toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">Lender Mode</Label>
              <div className="group relative">
                <button type="button" className="w-4 h-4 rounded-full border border-edge text-ash hover:text-star hover:border-star/40 flex items-center justify-center transition-colors" aria-label="What is multi-lender?">
                  <span className="text-[9px] font-bold">i</span>
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-elevated border border-edge-bright rounded-xl text-xs text-dust leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg">
                  <span className="text-chalk font-medium block mb-1">Single vs Multi-Lender</span>
                  <span className="block mb-1"><strong className="text-chalk">Single:</strong> One lender funds the entire loan. Faster settlement.</span>
                  <span className="block"><strong className="text-chalk">Multi:</strong> Multiple lenders can each fund a portion. Better for large loans — each lender chooses how much to contribute.</span>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-elevated border-r border-b border-edge-bright rotate-45 -mt-1" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMultiLender(false)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  !multiLender
                    ? 'border-star/40 bg-star/10 shadow-[0_0_12px_rgba(232,168,37,0.08)]'
                    : 'border-edge/30 bg-surface/40 hover:border-edge/50'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={!multiLender ? 'text-star' : 'text-ash'}>
                  <circle cx="8" cy="5" r="2.5" />
                  <path d="M3 14c0-2.5 2-4 5-4s5 1.5 5 4" />
                </svg>
                <span className={`text-xs font-semibold ${!multiLender ? 'text-star' : 'text-chalk'}`}>Single Lender</span>
                <span className="text-[9px] text-ash leading-tight text-center">One lender funds all</span>
              </button>
              <button
                type="button"
                onClick={() => setMultiLender(true)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  multiLender
                    ? 'border-star/40 bg-star/10 shadow-[0_0_12px_rgba(232,168,37,0.08)]'
                    : 'border-edge/30 bg-surface/40 hover:border-edge/50'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={multiLender ? 'text-star' : 'text-ash'}>
                  <circle cx="5" cy="5" r="2" />
                  <circle cx="11" cy="5" r="2" />
                  <path d="M1 14c0-2 1.5-3 4-3s4 1 4 3" />
                  <path d="M7 14c0-2 1.5-3 4-3s4 1 4 3" />
                </svg>
                <span className={`text-xs font-semibold ${multiLender ? 'text-star' : 'text-chalk'}`}>Multi-Lender</span>
                <span className="text-[9px] text-ash leading-tight text-center">Partial funding allowed</span>
              </button>
            </div>
          </div>

          {/* Duration + Deadline — side by side */}
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Duration */}
            <div className="p-4 bg-abyss/60 border border-edge/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
                  Loan Duration <span className="text-star">*</span>
                </Label>
                {useCustomDuration && (
                  <button
                    type="button"
                    onClick={() => setUseCustomDuration(false)}
                    className="text-[10px] text-star hover:text-star-bright transition-colors"
                  >
                    Presets
                  </button>
                )}
              </div>

              {useCustomDuration ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={customDurationValue}
                    onChange={(e) => setCustomDurationValue(e.target.value)}
                    className="flex-1 bg-surface/50 border-edge/50 font-mono"
                    placeholder="Amount"
                    min="1"
                    step="any"
                  />
                  <div className="flex gap-1">
                    {CUSTOM_DURATION_UNITS.map((u) => (
                      <button
                        key={u.multiplier}
                        type="button"
                        onClick={() => setCustomDurationUnit(u.multiplier)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] border transition-all whitespace-nowrap ${
                          customDurationUnit === u.multiplier
                            ? 'border-star/40 bg-star/10 text-star font-medium'
                            : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.seconds}
                        type="button"
                        onClick={() => setDurationPreset(p.seconds.toString())}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          durationPreset === p.seconds.toString()
                            ? 'border-star/40 bg-star/10 text-star font-medium'
                            : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomDuration(true)}
                    className="text-[10px] text-ash hover:text-star transition-colors uppercase tracking-widest"
                  >
                    Custom duration
                  </button>
                </div>
              )}
            </div>

            {/* Deadline */}
            <div className="p-4 bg-abyss/60 border border-edge/20 rounded-2xl space-y-3">
              <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
                Offer Expires In
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {DEADLINE_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => setDeadlinePreset(p.seconds.toString())}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all flex-1 text-center ${
                      deadlinePreset === p.seconds.toString()
                        ? 'border-star/40 bg-star/10 text-star font-medium'
                        : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ash">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0">
                  <circle cx="5" cy="5" r="4" />
                  <path d="M5 3v2.5l1.5 1" />
                </svg>
                <span>Expires {formatTimestamp(BigInt(deadline))}</span>
              </div>
            </div>
          </div>

          {/* Quick summary chips */}
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/40 border border-edge/20 text-[11px]">
              <span className="text-ash">Duration:</span>
              <span className="text-chalk font-medium">{formatDurationHuman(Number(duration))}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/40 border border-edge/20 text-[11px]">
              <span className="text-ash">Repay by:</span>
              <span className="text-chalk font-medium">{formatTimestamp(BigInt(Number(deadline) + Number(duration)))}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/40 border border-edge/20 text-[11px]">
              <span className="text-ash">Type:</span>
              <span className={`font-medium ${multiLender ? 'text-star' : 'text-chalk'}`}>
                {multiLender ? 'Multi-Lender' : 'Single-Lender'}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-edge/40 to-transparent" />

        {/* ══════════════════════════════════════════════════
            SECTION 2: ASSETS
           ══════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-nebula/15 border border-nebula/25 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-nebula">
                  <rect x="1" y="3" width="10" height="7" rx="1" />
                  <path d="M3 3V2a1 1 0 011-1h4a1 1 0 011 1v1" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-chalk">Assets</span>
                {totalAssets > 0 && (
                  <span className="ml-2 text-[10px] font-mono text-ash bg-surface px-1.5 py-0.5 rounded">
                    {totalAssets} total
                  </span>
                )}
              </div>
            </div>

            {/* THE unified add button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-1.5 border-dashed"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2v8M2 6h8" />
              </svg>
              Add Token
            </Button>
          </div>

          {/* 3-column asset display */}
          {totalAssets === 0 ? (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="w-full py-10 border-2 border-dashed border-edge/30 rounded-2xl hover:border-edge/50 transition-colors group"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface/60 border border-edge/30 flex items-center justify-center group-hover:border-star/30 group-hover:bg-star/5 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash group-hover:text-star transition-colors">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-sm text-dust block">Add your first token</span>
                  <span className="text-[10px] text-ash">Select a token, set amount, and assign its role</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <AssetColumn
                role="debt"
                assets={debtAssets}
                onRemove={(i) => setDebtAssets((prev) => prev.filter((_, j) => j !== i))}
                required
                showErrors={showErrors}
              />
              <AssetColumn
                role="collateral"
                assets={collateralAssets}
                onRemove={(i) => setCollateralAssets((prev) => prev.filter((_, j) => j !== i))}
                required
                showErrors={showErrors}
              />
              <AssetColumn
                role="interest"
                assets={interestAssets}
                onRemove={(i) => setInterestAssets((prev) => prev.filter((_, j) => j !== i))}
              />
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION 3: ROI PREVIEW
           ══════════════════════════════════════════════════ */}
        {roiInfo && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-edge/40 to-transparent" />
            <div className="flex items-center justify-between p-5 bg-star/[0.03] border border-star/15 rounded-2xl">
              <div>
                <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold block mb-1">
                  Projected Lender Yield
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display text-star">+{roiInfo.yieldPct}%</span>
                  <span className="text-dust text-sm">in {roiInfo.symbol}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Over</span>
                <span className="text-sm text-chalk font-medium">{formatDurationHuman(Number(duration))}</span>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            SECTION 4: SUBMIT
           ══════════════════════════════════════════════════ */}
        <div className="h-px bg-gradient-to-r from-transparent via-edge/40 to-transparent" />

        <Web3ActionWrapper message="Connect your wallet to create an inscription">
          <Button
            variant="gold"
            size="xl"
            className="w-full h-14 text-base uppercase tracking-widest"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Processing...' : 'Approve & Sign Order'}
          </Button>
          {showErrors && !isValid && (
            <p className="text-xs text-nova text-center mt-2">
              {!hasDebt && 'Add at least one borrow asset. '}
              {!hasCollateral && 'Add at least one collateral asset. '}
              {!hasDuration && 'Set a loan duration.'}
            </p>
          )}
        </Web3ActionWrapper>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <AddAssetModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={handleAddAsset}
        balances={balances}
      />

      <TransactionProgressModal
        open={createProgress.open}
        steps={createProgress.steps}
        txHash={createProgress.txHash}
        onClose={createProgress.close}
      />
    </div>
  )
}
