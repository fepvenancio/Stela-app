'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, toU256, getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { Asset, AssetType, TokenInfo } from '@fepvenancio/stela-sdk'
import { RpcProvider, typedData as starknetTypedData, CallData } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, NETWORK } from '@/lib/config'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import type { AssetInputValue } from '@/components/AssetInput'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { addOptimisticInscription } from '@/hooks/useInscriptions'
import { AssetRow } from './components/AssetRow'
import { AddAssetModal } from './components/AddAssetModal'

/* ── Types ──────────────────────────────────────────────── */

type AssetRole = 'debt' | 'collateral' | 'interest'

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

      // Push optimistic update to other pages (Portfolio/Stelas)
      addOptimisticInscription({
        id: orderId,
        creator: address,
        borrower: address,
        lender: null,
        status: 'pending', // Special status for optimistic UI
        issued_debt_percentage: '0',
        multi_lender: multiLender,
        duration: String(duration),
        deadline: String(deadline),
        signed_at: null,
        debt_asset_count: sdkDebtAssets.length,
        interest_asset_count: sdkInterestAssets.length,
        collateral_asset_count: sdkCollateralAssets.length,
        created_at_ts: String(Math.floor(Date.now() / 1000)),
        assets: [
          ...sdkDebtAssets.map((a, i) => ({ inscription_id: orderId, asset_role: 'debt' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          ...sdkInterestAssets.map((a, i) => ({ inscription_id: orderId, asset_role: 'interest' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          ...sdkCollateralAssets.map((a, i) => ({ inscription_id: orderId, asset_role: 'collateral' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
        ]
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

  return (
    <div className="animate-fade-up max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Inscribe a Stela
        </h1>
        <p className="text-dust max-w-lg leading-relaxed">
          {mode === 'offchain'
            ? 'Gasless signing — prepare your lending agreement and sign it without spending gas. Collateral is approved but stays in your wallet until settlement.'
            : 'On-chain inscription — lock your collateral and record your agreement directly on the network immediately.'}
        </p>
      </div>

      {/* ── Primary Tabs: Lending / Swap ─────────────────── */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-1 rounded-xl bg-surface/40 border border-edge/30 p-1 w-fit">
          {(['lending', 'swap'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setOrderType(t)
                if (t === 'swap') { setInterestAssets([]); setUseCustomDuration(false) }
                else if (durationPreset === '0') setDurationPreset('86400')
              }}
              className={`relative px-6 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                orderType === t
                  ? 'bg-star/15 text-star shadow-[0_0_12px_rgba(232,168,37,0.1)] border border-star/30'
                  : 'text-dust hover:text-chalk border border-transparent'
              }`}
            >
              {t === 'lending' ? 'Lending' : 'Swap'}
            </button>
          ))}
        </div>

        {/* ── Inline Settings Row ──────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ash uppercase tracking-widest font-bold whitespace-nowrap">Mode</span>
            <div className="flex gap-1">
              {(['offchain', 'onchain'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    mode === m
                      ? 'bg-star/10 text-star border border-star/25'
                      : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
                  }`}
                >
                  {m === 'offchain' ? 'Off-Chain' : 'On-Chain'}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-edge/40 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ash uppercase tracking-widest font-bold whitespace-nowrap">Funding</span>
            <div className="flex gap-1">
              {([
                { value: 'single', label: 'Single Lender' },
                { value: 'multi', label: 'Multi-Lender' },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setMultiLender(f.value === 'multi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    (multiLender ? 'multi' : 'single') === f.value
                      ? 'bg-star/10 text-star border border-star/25'
                      : 'text-dust hover:text-chalk border border-edge/40 hover:border-edge-bright'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-edge/40 hidden sm:block" />

          <button
            type="button"
            onClick={resetForm}
            className="text-ash hover:text-nova text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Assets & Matches */}
        <div className="lg:col-span-2 space-y-8">
          <section className="rounded-xl border border-edge/30 overflow-clip bg-surface/5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-edge/30 bg-surface/10">
              <span className="text-[11px] text-dust uppercase tracking-widest font-bold">
                Inscription Assets
                {allAssets.length > 0 && <span className="ml-2 text-star">({allAssets.length})</span>}
              </span>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-1.5 text-sm text-star hover:text-star-bright transition-colors font-medium cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
                Add Asset
              </button>
            </div>

            {/* Asset Table Header */}
            <div className="hidden md:flex items-center px-4 py-2 text-[10px] text-dust uppercase tracking-widest font-bold border-b border-edge/20 bg-void/30">
              <div className="flex-1">Asset</div>
              <div className="w-32 text-center">Amount / ID</div>
              <div className="w-32 text-center">Role</div>
              <div className="w-10"></div>
            </div>

            {/* Asset list */}
            {allAssets.length === 0 ? (
              <div
                onClick={() => setAddModalOpen(true)}
                className="w-full py-20 hover:bg-surface/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-surface/30 border border-edge/50 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash"><path d="M8 3v10M3 8h10" /></svg>
                </div>
                <div className="text-center">
                  <p className="text-chalk font-medium">No assets added yet</p>
                  <p className="text-xs text-dust max-w-[200px] mx-auto mt-1 leading-relaxed">
                    At least one debt and one collateral asset are required to create an inscription.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-edge/10">
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
              <div className="px-4 py-3 border-t border-edge/20 bg-nova/5">
                <p className="text-xs text-nova font-medium">
                  {!hasDebt && '• Add at least one borrow asset. '}
                  {!hasCollateral && '• Add at least one collateral asset.'}
                </p>
              </div>
            )}
          </section>

          {/* Matched Stelas */}
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
        </div>

        {/* Right Column: Terms & Action */}
        <div className="space-y-6">
          <section className="rounded-xl border border-edge/30 bg-surface/5 overflow-clip">
            <div className="px-4 py-3 border-b border-edge/30 bg-surface/10">
              <span className="text-[11px] text-dust uppercase tracking-widest font-bold">Terms & Duration</span>
            </div>

            <div className="p-4 space-y-6">
              {/* Duration (lending only) */}
              {!isSwap && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Loan Duration</span>
                    <button
                      type="button"
                      onClick={() => setUseCustomDuration(!useCustomDuration)}
                      className="text-[10px] text-star hover:text-star-bright transition-colors cursor-pointer font-bold uppercase tracking-wider"
                    >
                      {useCustomDuration ? 'Use Presets' : 'Custom'}
                    </button>
                  </div>
                  
                  {useCustomDuration ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={customDurationValue}
                          onChange={(e) => setCustomDurationValue(e.target.value)}
                          className="flex-1 bg-surface/50 border-edge/50 font-mono h-9 text-sm"
                          placeholder="Amount"
                          min="1"
                        />
                        <div className="flex gap-1">
                          {CUSTOM_DURATION_UNITS.map((u) => (
                            <button
                              key={u.multiplier}
                              type="button"
                              onClick={() => setCustomDurationUnit(u.multiplier)}
                              className={`px-3 py-1 rounded-lg text-[10px] border transition-all cursor-pointer font-medium ${
                                customDurationUnit === u.multiplier ? 'border-star/40 bg-star/10 text-star' : 'border-edge/50 text-dust hover:text-chalk'
                              }`}
                            >{u.label}</button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-dust italic">
                        Result: {formatDurationHuman(Number(duration))}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {DURATION_PRESETS.map((p) => (
                        <button
                          key={p.seconds}
                          type="button"
                          onClick={() => setDurationPreset(p.seconds.toString())}
                          className={`py-2 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                            durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star shadow-[0_0_10px_rgba(232,168,37,0.1)]' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                          }`}
                        >{p.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Deadline */}
              <div className="space-y-3">
                <span className="text-[10px] text-dust uppercase tracking-widest font-bold block">Order Expiry</span>
                <div className="grid grid-cols-3 gap-2">
                  {DEADLINE_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => setDeadlinePreset(p.seconds.toString())}
                      className={`py-2 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                        deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star shadow-[0_0_10px_rgba(232,168,37,0.1)]' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
                <p className="text-[10px] text-dust">
                  Agreement expires on {formatTimestamp(BigInt(deadline))}
                </p>
              </div>
            </div>
          </section>

          {/* Summary & Submit */}
          <section className="rounded-xl border border-star/30 bg-star/5 p-5 space-y-5">
            <div className="space-y-3">
              <span className="text-[11px] text-star uppercase tracking-[0.2em] font-bold block border-b border-star/20 pb-2">
                Agreement Summary
              </span>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-dust">Intent</span>
                  <span className="text-chalk font-medium uppercase tracking-wider">{orderType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dust">Network Mode</span>
                  <span className={`font-medium ${mode === 'onchain' ? 'text-star' : 'text-chalk'}`}>
                    {mode === 'offchain' ? 'Gasless (Off-Chain)' : 'On-Chain'}
                  </span>
                </div>
                {!isSwap && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dust">Duration</span>
                    <span className="text-chalk font-medium">{formatDurationHuman(Number(duration))}</span>
                  </div>
                )}
                {roiInfo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dust">Est. Yield</span>
                    <span className="text-aurora font-bold">+{roiInfo.yieldPct}%</span>
                  </div>
                )}
                {isSwap && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dust">Protocol Fee</span>
                    <span className="text-chalk font-medium">0.10%</span>
                  </div>
                )}
              </div>
            </div>

            <Web3ActionWrapper message="Connect your wallet to create an inscription">
              <Button
                variant="gold"
                size="lg"
                className="w-full h-14 uppercase tracking-[0.2em] text-sm shadow-[0_0_20px_rgba(232,168,37,0.15)] hover:shadow-[0_0_30px_rgba(232,168,37,0.25)] transition-all"
                onClick={handleSubmit}
                disabled={isPending || isCreatingOnChain || isChecking}
              >
                {isPending || isCreatingOnChain ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </div>
                ) : isChecking ? 'Checking matches...' : submitButtonText}
              </Button>
            </Web3ActionWrapper>
          </section>
        </div>
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
        const multiOpen = multiSettleModalOpen && multiSettleState.phase !== 'idle'
        // Only show TransactionProgressModal if no multi-settle modal is active
        if (active && !multiOpen) {
          return (
            <TransactionProgressModal
              open
              steps={active.steps}
              txHash={active.txHash}
              onClose={active.close}
            />
          )
        }
        if (multiOpen) {
          return (
            <MultiSettleProgressModal
              open
              state={multiSettleState}
              onClose={() => {
                setMultiSettleModalOpen(false)
                resetMultiSettle()
              }}
            />
          )
        }
        return null
      })()}
    </div>
  )
}
