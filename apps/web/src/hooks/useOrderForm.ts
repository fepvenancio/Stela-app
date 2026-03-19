'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, toU256, InscriptionClient } from '@fepvenancio/stela-sdk'
import type { Asset, AssetType, InscriptionParams } from '@fepvenancio/stela-sdk'
import { RpcProvider, typedData as starknetTypedData, CallData } from 'starknet'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { parseAmount } from '@/lib/amount'
import type { AssetInputValue } from '@/components/AssetInput'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { useInstantSettle, type MatchedOrder } from '@/hooks/useInstantSettle'
import { useMatchDetection } from '@/hooks/useMatchDetection'
import type { OnChainMatch } from '@/hooks/useMatchDetection'
import { useCreateInscription } from '@/hooks/useCreateInscription'
import { useWalletSign } from '@/hooks/useWalletSign'
import { useSignOnChainMatch } from '@/hooks/useSignOnChainMatch'
import { useMultiSettle } from '@/hooks/useMultiSettle'
import { selectOrders } from '@/lib/multi-match'
import { addOptimisticInscription } from '@/hooks/useInscriptions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

/* ── Types ──────────────────────────────────────────────── */

export type AssetRole = 'debt' | 'collateral' | 'interest'

export const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']

/* ── Hook ──────────────────────────────────────────────── */

export function useOrderForm(orderType: 'lending' | 'swap') {
  const isSwap = orderType === 'swap'
  const { address, account } = useAccount()
  const queryClient = useQueryClient()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const provider = useMemo(() => new RpcProvider({ nodeUrl: RPC_URL }), [])

  /* ── Form State ────────────────────────────────────────── */

  const [mode, setMode] = useState<'offchain' | 'onchain'>('offchain')
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([])

  // Duration (lending only)
  const [durationPreset, setDurationPreset] = useState('86400')
  const [customDurationValue, setCustomDurationValue] = useState('')
  const [customDurationUnit, setCustomDurationUnit] = useState(86400)
  const [useCustomDuration, setUseCustomDuration] = useState(false)

  const duration = useMemo(() => {
    if (isSwap) return '0'
    if (useCustomDuration && customDurationValue) {
      const parsed = parseFloat(customDurationValue)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return String(Math.round(parsed * customDurationUnit))
      }
    }
    return durationPreset
  }, [isSwap, durationPreset, customDurationValue, customDurationUnit, useCustomDuration])

  // Deadline
  const [deadlinePreset, setDeadlinePreset] = useState(isSwap ? '1800' : '604800')

  const deadline = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    return (now + Number(deadlinePreset)).toString()
  }, [deadlinePreset])

  const [showErrors, setShowErrors] = useState(false)
  const { balances } = useTokenBalances()
  const [addModalOpen, setAddModalOpen] = useState(false)

  /* ── Progress Modals ──────────────────────────────────── */

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

  // Multi-settle (aggregate)
  const { settleMultiple, state: multiSettleState, reset: resetMultiSettle } = useMultiSettle()
  const [multiSettleModalOpen, setMultiSettleModalOpen] = useState(false)

  // On-chain match settlement
  const { signOnChainMatch: settleOnChainMatch, isPending: isSettlingOnChain } = useSignOnChainMatch()
  const onchainSettleProgress = useTransactionProgress([
    { label: 'Approve & settle', description: 'Confirm the transaction in your wallet' },
    { label: 'Confirming', description: 'Waiting for block confirmation' },
    { label: 'Done', description: 'Settlement complete' },
  ])

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
  const isValid = hasDebt && hasCollateral && (isSwap || hasDuration)

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

  // ROI Math (lending only)
  const roiInfo = useMemo(() => {
    if (isSwap) return null
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
  }, [debtAssets, interestAssets, isSwap])

  const advancedDefaultRole = useMemo((): AssetRole => {
    if (!hasDebt) return 'debt'
    if (!hasCollateral) return 'collateral'
    if (!isSwap && !interestAssets.some(a => a.asset)) return 'interest'
    return 'debt'
  }, [hasDebt, hasCollateral, isSwap, interestAssets])

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

  /* ── Asset Handlers ─────────────────────────────────── */

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

  /* ── Submit Logic ──────────────────────────────────── */

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
    setDebtAssets([])
    setInterestAssets([])
    setCollateralAssets([])
    setDurationPreset('86400')
    setCustomDurationValue('')
    setCustomDurationUnit(86400)
    setUseCustomDuration(false)
    setDeadlinePreset(isSwap ? '1800' : '604800')
    setMultiLender(false)
    setShowErrors(false)
    setMatchesVisible(false)
    setBroadcastMode(false)
    resetMatches()
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

  async function handleSettleAndBroadcast() {
    if (!address || !account || !multiSettleSelection) return
    closeAllProgress()
    setMultiSettleModalOpen(true)

    const sdkDebtAssets = toSdkAssets(debtAssets)
    const sdkInterestAssets = toSdkAssets(interestAssets)
    const sdkCollateralAssets = toSdkAssets(collateralAssets)

    const totalGive = userGiveAmount
    const matchedGive = multiSettleSelection.totalGive
    const remainder = totalGive - matchedGive

    if (remainder <= 0n) {
      return handleMultiSettle()
    }

    const scaleDown = (assets: Asset[]): Asset[] =>
      assets.map(a => ({
        ...a,
        value: totalGive > 0n ? (a.value * remainder) / totalGive : 0n,
      })).filter(a => a.value > 0n || a.asset_type === 'ERC721')

    const remainderDebt = scaleDown(sdkDebtAssets)
    const remainderInterest = scaleDown(sdkInterestAssets)
    const remainderCollateral = scaleDown(sdkCollateralAssets)

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

      const tempId = `pending-onchain-${Date.now()}`
      addOptimisticInscription(queryClient, {
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
        auction_started: 0,
        auction_start_time: '0',
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
      toast.success(isSwap ? 'Swap order created' : 'Order signed & submitted', {
        description: isSwap
          ? 'Your swap is now live. No gas was spent!'
          : 'Your inscription order is now live. No gas was spent!',
      })

      queryClient.invalidateQueries()

      addOptimisticInscription(queryClient, {
        id: orderId,
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
        auction_started: 0,
        auction_start_time: '0',
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

  async function handleSubmit() {
    if (!address || !account) return
    setShowErrors(true)
    if (!isValid) return

    if (hasMatches && !broadcastMode) {
      const coverage = multiSettleSelection?.coverage ?? 0
      const hasPartialCoverage = coverage > 0 && coverage < 100

      if (hasPartialCoverage && multiSettleSelection) {
        await handleSettleAndBroadcast()
        return
      }

      if (multiSettleSelection && multiSettleSelection.selected.length >= 2) {
        await handleMultiSettle()
        return
      }
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

  return {
    // Identity
    isSwap,
    orderType,
    address,

    // Form state
    mode, setMode,
    multiLender, setMultiLender,
    debtAssets, setDebtAssets,
    interestAssets, setInterestAssets,
    collateralAssets, setCollateralAssets,

    // Duration (lending only)
    duration,
    durationPreset, setDurationPreset,
    customDurationValue, setCustomDurationValue,
    customDurationUnit, setCustomDurationUnit,
    useCustomDuration, setUseCustomDuration,

    // Deadline
    deadlinePreset, setDeadlinePreset,
    deadline,

    // Derived
    hasDebt, hasCollateral, hasDuration, isValid,
    allAssets,
    roiInfo,
    advancedDefaultRole,
    submitButtonText,
    giveSymbol, receiveSymbol,

    // Validation
    showErrors, setShowErrors,

    // Balances
    balances,

    // Modal state
    addModalOpen, setAddModalOpen,

    // Match detection
    offchainMatches, onchainMatches,
    isChecking, hasMatches,
    matchesVisible, broadcastMode, setBroadcastMode,
    multiSettleSelection,

    // Progress
    createProgress, settleProgress, onchainProgress, onchainSettleProgress,
    multiSettleState, multiSettleModalOpen, setMultiSettleModalOpen, resetMultiSettle,
    isPending, isCreatingOnChain, isSettling, isSettlingOnChain,

    // Handlers
    handleSubmit,
    handleAddAsset,
    handleRemoveAsset,
    handleInstantSettle,
    handleOnchainSettle,
    handleMultiSettle,
    resetForm,
  }
}
