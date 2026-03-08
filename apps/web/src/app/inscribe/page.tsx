'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, toU256, getTokensForNetwork, InscriptionClient } from '@fepvenancio/stela-sdk'
import type { Asset, AssetType, TokenInfo, InscriptionParams } from '@fepvenancio/stela-sdk'
import { RpcProvider, typedData as starknetTypedData, CallData } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, NETWORK } from '@/lib/config'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import type { AssetInputValue } from '@/components/AssetInput'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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

const LOAN_DEADLINE_PRESETS = [
  { label: '7d', seconds: 604800 },
  { label: '14d', seconds: 1209600 },
  { label: '30d', seconds: 2592000 },
  { label: '60d', seconds: 5184000 },
  { label: '90d', seconds: 7776000 },
]

const SWAP_DEADLINE_PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '12h', seconds: 43200 },
  { label: '1d', seconds: 86400 },
  { label: '7d', seconds: 604800 },
  { label: '30d', seconds: 2592000 },
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

  // Deadline — swap uses shorter timeframes, lending uses longer
  const deadlinePresets = orderType === 'swap' ? SWAP_DEADLINE_PRESETS : LOAN_DEADLINE_PRESETS
  const [deadlinePreset, setDeadlinePreset] = useState('604800')

  // Reset deadline preset when switching order type
  useEffect(() => {
    setDeadlinePreset(orderType === 'swap' ? '1800' : '604800')
  }, [orderType])

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
  const [broadcastMode, setBroadcastMode] = useState(false)

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
    { label: 'Approve & settle', description: 'Confirm the transaction in your wallet' },
    { label: 'Confirming', description: 'Waiting for block confirmation' },
    { label: 'Done', description: 'Settlement complete' },
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

  // Multi-settle selection (works for both swaps and loans)
  const userGiveAmount = useMemo(() => {
    if (collateralAssets.length !== 1 || !collateralAssets[0].asset) return 0n
    const a = collateralAssets[0]
    return a.value ? parseAmount(a.value, a.decimals) : 0n
  }, [collateralAssets])

  const multiSettleSelection = useMemo(() => {
    const totalMatches = offchainMatches.length + onchainMatches.length
    if (totalMatches === 0 || userGiveAmount <= 0n) return null
    return selectOrders(offchainMatches, onchainMatches, userGiveAmount)
  }, [offchainMatches, onchainMatches, userGiveAmount])

  const submitButtonText = useMemo(() => {
    const showingMatches = matchesVisible && hasMatches && !broadcastMode
    if (showingMatches) {
      const coverage = multiSettleSelection?.coverage ?? 0
      if (coverage > 0 && coverage < 100) {
        return isSwap ? `Swap ${coverage}% + Broadcast` : `Fill ${coverage}% + Broadcast`
      }
      return isSwap ? 'Swap Now' : 'Fill Match'
    }
    if (mode === 'offchain') {
      return isSwap ? 'Sign & Create Swap' : 'Sign & Create Order'
    }
    return isSwap ? 'Create On-Chain Swap' : 'Create On-Chain Inscription'
  }, [mode, isSwap, matchesVisible, hasMatches, broadcastMode, multiSettleSelection])

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
    setBroadcastMode(false)

    if (!address) return
    if (filteredDebtForMatch.length !== 1 || filteredCollateralForMatch.length !== 1) return

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
  }, [filteredDebtForMatch, filteredCollateralForMatch, duration, address])

  useEffect(() => {
    if (hasMatches) {
      setMatchesVisible(true)
    }
  }, [hasMatches])

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
    setBroadcastMode(false)
    resetMatches()
  }

  async function handleSubmit() {
    if (!address || !account) return
    setShowErrors(true)
    if (!isValid) return

    // When matches exist and broadcast mode is off, settle with matches
    if (hasMatches && !broadcastMode) {
      // Check if we need to inscribe a remainder (coverage < 100%)
      const coverage = multiSettleSelection?.coverage ?? 0
      const hasPartialCoverage = coverage > 0 && coverage < 100

      if (hasPartialCoverage && multiSettleSelection) {
        // Settle matches + inscribe the remainder in one multicall
        await handleSettleAndBroadcast()
        return
      }

      // Full coverage — settle only
      if (multiSettleSelection && multiSettleSelection.selected.length >= 2) {
        await handleMultiSettle()
        return
      }
      // Single best match: prefer off-chain (cheaper), fall back to on-chain
      if (offchainMatches.length > 0) {
        await handleInstantSettle(offchainMatches[0])
        return
      }
      if (onchainMatches.length > 0) {
        await handleOnchainSettle(onchainMatches[0])
        return
      }
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

  /**
   * Settle matched orders + create an inscription for the unmatched remainder.
   * All in one atomic multicall: approve → settle matches → create_inscription(remainder).
   */
  async function handleSettleAndBroadcast() {
    if (!address || !account || !multiSettleSelection) return
    closeAllProgress()
    setMultiSettleModalOpen(true)

    const sdkDebtAssets = toSdkAssets(debtAssets)
    const sdkInterestAssets = toSdkAssets(interestAssets)
    const sdkCollateralAssets = toSdkAssets(collateralAssets)

    // Compute remainder amounts (proportional scaling)
    const totalGive = userGiveAmount
    const matchedGive = multiSettleSelection.totalGive
    const remainder = totalGive - matchedGive

    if (remainder <= 0n) {
      // Full coverage — just settle
      return handleMultiSettle()
    }

    // Scale each asset proportionally for the remainder inscription
    const scaleDown = (assets: Asset[]): Asset[] =>
      assets.map(a => ({
        ...a,
        value: totalGive > 0n ? (a.value * remainder) / totalGive : 0n,
      })).filter(a => a.value > 0n || a.asset_type === 'ERC721')

    const remainderDebt = scaleDown(sdkDebtAssets)
    const remainderInterest = scaleDown(sdkInterestAssets)
    const remainderCollateral = scaleDown(sdkCollateralAssets)

    // Build create_inscription call for the remainder
    const client = new InscriptionClient({
      stelaAddress: CONTRACT_ADDRESS,
      provider: new RpcProvider({ nodeUrl: RPC_URL }),
    })

    const createCall = client.buildCreateInscription({
      is_borrow: true,
      debt_assets: remainderDebt,
      interest_assets: remainderInterest,
      collateral_assets: remainderCollateral,
      duration: BigInt(duration || '0'),
      deadline: BigInt(deadline || '0'),
      multi_lender: multiLender,
    } as InscriptionParams)

    // Build extra approval amounts for remainder collateral
    const extraApproveAmounts = new Map<string, { amount: bigint; address: string }>()
    for (const asset of remainderCollateral) {
      if (asset.asset_type === 'ERC20' || asset.asset_type === 'ERC4626') {
        if (asset.value <= 0n) continue
        const key = asset.asset_address.toLowerCase()
        const existing = extraApproveAmounts.get(key)
        if (existing) existing.amount += asset.value
        else extraApproveAmounts.set(key, { amount: asset.value, address: asset.asset_address })
      }
    }

    // Also add set_approval_for_all for ERC721/ERC1155 collateral
    const nftApprovals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
    for (const asset of remainderCollateral) {
      if (asset.asset_type === 'ERC721' || asset.asset_type === 'ERC1155') {
        nftApprovals.push({
          contractAddress: asset.asset_address,
          entrypoint: 'set_approval_for_all',
          calldata: [CONTRACT_ADDRESS, '1'],
        })
      }
    }

    try {
      await settleMultiple(multiSettleSelection.selected, {
        extraCalls: [...nftApprovals, createCall],
        extraApproveAmounts,
      })
      toast.success('Settled matches + inscribed remainder!')
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

      // On-chain inscription optimistic update
      const tempId = `pending-onchain-${Date.now()}`
      addOptimisticInscription({
        id: tempId,
        creator: address,
        borrower: address,
        lender: null,
        status: 'pending',
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
          ...sdkDebtAssets.map((a, i) => ({ inscription_id: tempId, asset_role: 'debt' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          ...sdkInterestAssets.map((a, i) => ({ inscription_id: tempId, asset_role: 'interest' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
          ...sdkCollateralAssets.map((a, i) => ({ inscription_id: tempId, asset_role: 'collateral' as const, asset_index: i, asset_address: a.asset_address, asset_type: a.asset_type, value: a.value.toString(), token_id: a.token_id.toString() })),
        ]
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
      const U128_MAX = (1n << 128n) - 1n

      // Always approve U128_MAX for collateral tokens — exact approvals get
      // consumed when settle() is called, breaking subsequent matches.
      if (erc20Collateral.length > 0) {
        const approvedTokens = new Set<string>()
        for (const asset of erc20Collateral) {
          const key = asset.asset_address.toLowerCase()
          if (approvedTokens.has(key)) continue
          approvedTokens.add(key)
          pendingApprovals.push({
            contractAddress: asset.asset_address,
            entrypoint: 'approve',
            calldata: [CONTRACT_ADDRESS, ...toU256(U128_MAX)],
          })
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

      // Trigger immediate refetch of orders/inscriptions lists
      window.dispatchEvent(new Event('stela:sync'))

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
    <div className="animate-fade-up pb-24 relative">

      {/* ── Ambient Background ───────────────────────────── */}
      <div className="fixed top-1/4 -left-20 w-64 h-64 bg-star/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-64 h-64 bg-nebula/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* ── Header ────────── */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          Inscribe
        </h1>
        <p className="text-dust max-w-lg leading-relaxed mb-6">
          Lend or swap any ERC20 — stables, vault shares, LP tokens — fully peer-to-peer. Every position becomes a tradeable share on a built-in secondary market.
        </p>

        {/* Controls row: Type + Mode + Funding + Reset */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Lending / Swap Toggle */}
          <div className="bg-void/60 backdrop-blur border border-edge/30 p-1 rounded-xl flex items-center gap-0.5">
            {(['lending', 'swap'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setOrderType(t)
                  if (t === 'swap') { setInterestAssets([]); setUseCustomDuration(false) }
                  else if (durationPreset === '0') setDurationPreset('86400')
                }}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-display tracking-[0.2em] transition-all duration-300 cursor-pointer uppercase ${
                  orderType === t
                    ? 'bg-star/10 text-star border border-star/20'
                    : 'text-dust/60 hover:text-dust border border-transparent'
                }`}
              >
                {t === 'lending' ? 'Lending' : 'Swap'}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-edge/40 hidden sm:block" />

          {/* Mode */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ash uppercase tracking-widest font-bold whitespace-nowrap">Mode</span>
            <div className="flex gap-1">
              {(['offchain', 'onchain'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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

          {/* Funding */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ash uppercase tracking-widest font-bold whitespace-nowrap">Funding</span>
            <div className="flex gap-1">
              {([
                { value: 'single', label: 'Single' },
                { value: 'multi', label: 'Multi' },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setMultiLender(f.value === 'multi')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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

          {/* Reset */}
          <button
            type="button"
            onClick={resetForm}
            className="text-ash hover:text-nova text-[10px] uppercase tracking-widest font-bold transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Terms & Duration ─────────────────────────────── */}
      <section className="rounded-xl border border-edge/30 bg-surface/5 overflow-clip mb-8">
        <div className="px-4 py-2.5 border-b border-edge/30 bg-surface/10">
          <span className="text-[10px] text-dust uppercase tracking-widest font-bold">Terms & Duration</span>
        </div>

        <div className="p-4 flex flex-col md:flex-row md:items-start gap-6">
          {/* Duration (lending only) */}
          {!isSwap && (
            <div className="space-y-3 flex-1 min-w-0">
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
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => setDurationPreset(p.seconds.toString())}
                      className={`py-2 px-4 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                        durationPreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star shadow-[0_0_10px_rgba(232,168,37,0.1)]' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {!isSwap && <div className="hidden md:block w-px self-stretch bg-edge/30" />}

          {/* Deadline / Expiry */}
          <div className="space-y-3 flex-1 min-w-0">
            <span className="text-[10px] text-dust uppercase tracking-widest font-bold block">Order Expiry</span>
            <div className="flex flex-wrap gap-2">
              {deadlinePresets.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setDeadlinePreset(p.seconds.toString())}
                  className={`py-2 px-4 rounded-lg text-xs border transition-all cursor-pointer font-medium ${
                    deadlinePreset === p.seconds.toString() ? 'border-star/40 bg-star/10 text-star shadow-[0_0_10px_rgba(232,168,37,0.1)]' : 'border-edge/50 text-dust hover:text-chalk hover:border-edge-bright'
                  }`}
                >{p.label}</button>
              ))}
            </div>
            <p className="text-[10px] text-dust" suppressHydrationWarning>
              Expires {formatTimestamp(BigInt(deadline))}
            </p>
          </div>
        </div>
      </section>

      {/* ── Asset Table + Summary Grid ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Left: Asset List */}
        <div className="lg:col-span-2 flex flex-col">
          <section className="rounded-xl border border-edge/30 overflow-clip bg-surface/5 flex flex-col flex-1">
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

            {/* Table Header */}
            <div className="hidden md:flex items-center px-4 py-2 text-[10px] text-dust uppercase tracking-widest font-bold border-b border-edge/20 bg-void/30">
              <div className="flex-1">Asset</div>
              <div className="w-32 text-center">Amount / ID</div>
              <div className="w-32 text-center">Role</div>
              <div className="w-10"></div>
            </div>

            {/* Asset Rows */}
            {allAssets.length === 0 ? (
              <div
                onClick={() => setAddModalOpen(true)}
                className="w-full flex-1 min-h-[200px] hover:bg-surface/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4"
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
              <div className="divide-y divide-edge/10 flex-1">
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
        </div>

        {/* Right: Agreement Summary — stretches to match asset table height */}
        <div className="flex flex-col">
          <section className="rounded-xl border border-star/30 bg-star/5 p-5 flex flex-col flex-1 lg:sticky lg:top-24">
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
                <div className="flex justify-between text-sm">
                  <span className="text-dust">Expiry</span>
                  <span className="text-chalk font-medium" suppressHydrationWarning>{formatTimestamp(BigInt(deadline))}</span>
                </div>
                {roiInfo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dust">Est. Yield</span>
                    <span className="text-aurora font-bold">+{roiInfo.yieldPct}%</span>
                  </div>
                )}
                {isSwap && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dust">Protocol Fee</span>
                    <span className="text-chalk font-medium">0.15%</span>
                  </div>
                )}
                {matchesVisible && hasMatches && (
                  <div className="flex justify-between items-center text-sm pt-1 border-t border-star/10">
                    <span className="text-dust">Broadcast</span>
                    <Switch
                      size="sm"
                      checked={broadcastMode}
                      onCheckedChange={setBroadcastMode}
                      className="data-[state=checked]:bg-star"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Spacer — pushes button to bottom when sidebar is taller than content */}
            <div className="flex-1 min-h-5" />

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

      {/* ── Match Detection ──────────────────────────────── */}
      {matchesVisible && hasMatches && !broadcastMode && (
        <div className="mt-10">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="w-2 h-2 rounded-full bg-star animate-ping" />
            <span className="text-[10px] font-display tracking-[0.25em] text-star uppercase">
              {isSwap && multiSettleSelection
                ? multiSettleSelection.coverage >= 100
                  ? 'Fully Matched'
                  : `${multiSettleSelection.coverage}% Matched`
                : 'Match Detected'}
            </span>
          </div>
          <InlineMatchList
            offchainMatches={offchainMatches}
            onchainMatches={onchainMatches}
            isSwap={isSwap}
            onSettleOffchain={handleInstantSettle}
            onSettleOnchain={handleOnchainSettle}
            onSettleMultiple={handleMultiSettle}
            isSettling={isSettling || isSettlingOnChain || multiSettleState.phase !== 'idle'}
            multiSettleSelection={multiSettleSelection}
            giveSymbol={giveSymbol}
            receiveSymbol={receiveSymbol}
          />
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
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
