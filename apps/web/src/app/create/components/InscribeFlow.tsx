'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
import { AssetRow } from './AssetRow'
import { AddAssetModal } from './AddAssetModal'
import { SwapCard } from './SwapCard'


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

export function InscribeFlow({ initialType = 'lending' }: { initialType?: 'lending' | 'swap' }) {
  const router = useRouter()
  const pathname = usePathname()
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  /* ── Form State ────────────────────────────────────────── */

  const [orderType, setOrderType] = useState<'lending' | 'swap'>(initialType)

  // Sync internal state if URL changes (e.g. user navigates via sidebar)
  useEffect(() => {
    if (pathname === '/swap' && orderType !== 'swap') setOrderType('swap')
    if (pathname === '/lend' && orderType !== 'lending') setOrderType('lending')
  }, [pathname])

  const handleToggle = (type: 'lending' | 'swap') => {
    setOrderType(type)
    if (type === 'swap') {
      setInterestAssets([])
      setUseCustomDuration(false)
      if (pathname !== '/create') router.push('/swap')
    } else {
      if (durationPreset === '0') setDurationPreset('86400')
      if (pathname !== '/create') router.push('/lend')
    }
  }
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

  // Deadline — preset is the offset in seconds; actual deadline computed fresh at submission
  const [deadlinePreset, setDeadlinePreset] = useState('604800')
  const deadlinePreview = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    return (now + Number(deadlinePreset)).toString()
  }, [deadlinePreset])
  const freshDeadline = () => (Math.floor(Date.now() / 1000) + Number(deadlinePreset)).toString()

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
    const deadline = freshDeadline()

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
    const deadline = freshDeadline()

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
    <div className="animate-fade-up max-w-7xl mx-auto pb-24">
      {/* Premium Artifact Header */}
      <div className="flex flex-col items-center mb-16 text-center">
        <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-star/10 border border-star/20 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-star animate-pulse" />
          <span className="text-[10px] font-display tracking-[0.3em] text-star uppercase">Protocol Artifact</span>
        </div>
        
        <h1 className="font-display text-4xl sm:text-5xl tracking-[0.4em] text-chalk mb-8 uppercase">
          Inscribe
        </h1>
        
        {/* Artifact Toggles */}
        <div className="bg-void/60 backdrop-blur border border-edge/30 p-1.5 rounded-[24px] flex items-center gap-1.5 shadow-2xl">
          <button 
            onClick={() => handleToggle('lending')}
            className={`px-8 py-3 rounded-[18px] text-[11px] font-display tracking-[0.2em] transition-all duration-500 ${
              orderType === 'lending' ? 'bg-star/10 text-star shadow-[0_0_15px_rgba(232,168,37,0.1)] border border-star/20' : 'text-dust/60 hover:text-dust'
            }`}
          >
            LENDING
          </button>
          <button 
            onClick={() => handleToggle('swap')}
            className={`px-8 py-3 rounded-[18px] text-[11px] font-display tracking-[0.2em] transition-all duration-500 ${
              orderType === 'swap' ? 'bg-star/10 text-star shadow-[0_0_15px_rgba(232,168,37,0.1)] border border-star/20' : 'text-dust/60 hover:text-dust'
            }`}
          >
            SWAP
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-16">
        {/* The Artifact Card */}
        <SwapCard 
          orderType={orderType}
          mode={mode}
          multiLender={multiLender}
          debtAssets={debtAssets}
          collateralAssets={collateralAssets}
          interestAssets={interestAssets}
          duration={duration}
          deadline={deadlinePreview}
          onAddAsset={handleAddAsset}
          onRemoveAsset={handleRemoveAsset}
          onSubmit={handleSubmit}
          isPending={isPending || isCreatingOnChain || isChecking}
          submitButtonText={submitButtonText}
          balances={balances}
          useCustomDuration={useCustomDuration}
          setUseCustomDuration={setUseCustomDuration}
          durationPreset={durationPreset}
          setDurationPreset={setDurationPreset}
          customDurationValue={customDurationValue}
          setCustomDurationValue={setCustomDurationValue}
          customDurationUnit={customDurationUnit}
          setCustomDurationUnit={setCustomDurationUnit}
          deadlinePreset={deadlinePreset}
          setDeadlinePreset={setDeadlinePreset}
          formatDurationHuman={formatDurationHuman}
          formatTimestamp={formatTimestamp}
          roiInfo={roiInfo}
        />

        {/* Live Matching Stream */}
        {matchesVisible && !matchSkipped && hasMatches && (
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-6 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-star animate-ping" />
                <h2 className="font-display text-xs text-star uppercase tracking-[0.3em]">Protocol Match Detected</h2>
              </div>
              <button 
                onClick={() => setMatchSkipped(true)} 
                className="text-[10px] font-display tracking-[0.2em] text-ash hover:text-nova transition-colors uppercase underline underline-offset-8 decoration-edge/50"
              >
                Skip Analysis
              </button>
            </div>
            
            <div className="bg-void/40 backdrop-blur-xl border border-edge/20 rounded-[32px] overflow-hidden p-2 shadow-2xl">
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
            </div>
          </div>
        )}
      </div>

      {/* Background Artifact Elements (Optional/Ambient) */}
      <div className="fixed top-1/4 -left-20 w-64 h-64 bg-star/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-64 h-64 bg-nebula/5 rounded-full blur-[120px] pointer-events-none" />

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
