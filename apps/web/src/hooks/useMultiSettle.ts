'use client'

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import { InscriptionClient, findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { Asset } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { getInscriptionOrderTypedData, getBatchLendOfferTypedData, hashAssets, hashBatchEntries, getNonce } from '@/lib/offchain'
import type { BatchEntry } from '@/lib/offchain'
import { findAggregatedBalanceShortfall } from '@/lib/balance'
import { buildApprovalsIfNeeded } from '@/lib/allowance'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { useWalletSign } from '@/hooks/useWalletSign'
import type { SelectedOrder, SelectedOffchainOrder, SelectedOnchainOrder } from '@/lib/multi-match'
import { parseSigToArray } from '@/lib/signature'
import { toSdkAssets } from '@/lib/asset-conversion'

export type MultiSettlePhase =
  | 'idle' | 'validating' | 'signing' | 'executing'
  | 'confirming' | 'recording' | 'done' | 'error'

export interface MultiSettleState {
  phase: MultiSettlePhase
  signingIndex: number      // current off-chain offer being signed
  offchainTotal: number     // total off-chain orders needing signatures
  onchainTotal: number      // total on-chain orders (no signatures needed)
  totalOrders: number
  txHash: string | null
  error: string | null
}

const INITIAL_STATE: MultiSettleState = {
  phase: 'idle',
  signingIndex: 0,
  offchainTotal: 0,
  onchainTotal: 0,
  totalOrders: 0,
  txHash: null,
  error: null,
}

export function useMultiSettle() {
  const { address, account } = useAccount()
  const queryClient = useQueryClient()
  const { signTypedData } = useWalletSign()
  const [state, setState] = useState<MultiSettleState>(INITIAL_STATE)
  const pendingRef = useRef(false)

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  const settleMultiple = useCallback(
    async (
      selectedOrders: SelectedOrder[],
      options?: {
        /** Additional calls appended after settle calls (e.g. create_inscription for remainder) */
        extraCalls?: { contractAddress: string; entrypoint: string; calldata: string[] }[]
        /** Additional ERC20 approval amounts per token address (added to settlement approvals) */
        extraApproveAmounts?: Map<string, { amount: bigint; address: string }>
      },
    ) => {
      if (!address || !account) throw new Error('Wallet not connected')
      if (selectedOrders.length === 0) throw new Error('No orders selected')
      if (pendingRef.current) throw new Error('Settlement already in progress')

      pendingRef.current = true

      const offchainOrders = selectedOrders.filter((s): s is SelectedOffchainOrder => s.type === 'offchain')
      const onchainOrders = selectedOrders.filter((s): s is SelectedOnchainOrder => s.type === 'onchain')

      setState({
        phase: 'validating',
        signingIndex: 0,
        offchainTotal: offchainOrders.length,
        onchainTotal: onchainOrders.length,
        totalOrders: selectedOrders.length,
        txHash: null,
        error: null,
      })

      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })

        // 1. Self-lending check for off-chain orders
        for (const so of offchainOrders) {
          const borrowerAddr = ((so.order.order_data.borrower as string) || so.order.borrower).toLowerCase()
          if (borrowerAddr === address.toLowerCase()) {
            throw new Error('Cannot lend to your own order')
          }
        }

        // 2. Verify off-chain borrower nonces (filter stale)
        const validOffchain: SelectedOffchainOrder[] = []
        for (const so of offchainOrders) {
          const orderData = so.order.order_data
          const orderNonceRaw = String(orderData.nonce ?? so.order.nonce ?? '0')
          const orderNonce = BigInt(orderNonceRaw)
          const borrowerAddr = (orderData.borrower as string) || so.order.borrower
          const borrowerOnChainNonce = await getNonce(provider, CONTRACT_ADDRESS, borrowerAddr)

          if (borrowerOnChainNonce === orderNonce) {
            validOffchain.push(so)
          } else {
            toast.warning(`Skipping stale order from ${borrowerAddr.slice(0, 10)}...`, {
              description: `Nonce mismatch: order has ${orderNonceRaw}, on-chain is ${borrowerOnChainNonce}`,
            })
          }
        }

        const totalValid = validOffchain.length + onchainOrders.length
        if (totalValid === 0) {
          throw new Error('No valid orders remaining after nonce verification')
        }

        setState((s) => ({
          ...s,
          offchainTotal: validOffchain.length,
          totalOrders: totalValid,
        }))

        // 3. Aggregated balance check across all orders
        const allOrderAssets: { debtAssets: Asset[]; bps: number }[] = []

        for (const so of validOffchain) {
          const d = so.order.order_data
          const debtArr = (d.debtAssets ?? d.debt_assets) as Record<string, string>[] | undefined
          allOrderAssets.push({ debtAssets: toSdkAssets(debtArr), bps: so.bps })
        }
        for (const so of onchainOrders) {
          const debtAssets = toSdkAssets(so.match.debtAssets as Record<string, string>[] | undefined)
          allOrderAssets.push({ debtAssets, bps: so.bps })
        }

        const shortfall = await findAggregatedBalanceShortfall(provider, address, allOrderAssets)
        if (shortfall) {
          throw new Error(
            `Insufficient ${shortfall.symbol} balance. You need ${shortfall.neededFormatted} but only have ${shortfall.balanceFormatted}.`
          )
        }

        // 3b. Pre-flight borrower collateral allowance check for off-chain orders.
        // The borrower must have approved the Stela contract for collateral when
        // they created their order. If consumed or missing, settle() reverts.
        for (const so of validOffchain) {
          const d = so.order.order_data
          const collateralArr = (d.collateralAssets ?? d.collateral_assets) as Record<string, string>[] | undefined
          const sdkCollateral = toSdkAssets(collateralArr)
          const borrowerAddr = (d.borrower as string) || so.order.borrower
          for (const asset of sdkCollateral) {
            if (asset.asset_type !== 'ERC20' && asset.asset_type !== 'ERC4626') continue
            if (asset.value <= 0n) continue
            try {
              const result = await provider.callContract({
                contractAddress: asset.asset_address,
                entrypoint: 'allowance',
                calldata: [borrowerAddr, CONTRACT_ADDRESS],
              })
              const allowance = BigInt(result[0]) + (BigInt(result[1] ?? '0') << 128n)
              if (allowance < asset.value) {
                const token = findTokenByAddress(asset.asset_address)
                const sym = token?.symbol ?? asset.asset_address.slice(0, 10) + '...'
                throw new Error(
                  `Borrower ${borrowerAddr.slice(0, 10)}... hasn't approved enough ${sym} collateral. ` +
                  `They need to re-approve the Stela contract before this order can be settled.`
                )
              }
            } catch (err) {
              if (err instanceof Error && err.message.includes('approved enough')) throw err
            }
          }
        }

        // 4. Get lender nonce (needed for batch offer)
        const lenderNonce = validOffchain.length > 0
          ? await getNonce(provider, CONTRACT_ADDRESS, address)
          : 0n

        // 5. Prepare off-chain order data and compute order hashes
        setState((s) => ({ ...s, phase: 'signing' }))

        interface PreparedOrder {
          so: SelectedOffchainOrder
          orderHash: string
          sdkDebtAssets: Asset[]
          sdkInterestAssets: Asset[]
          sdkCollateralAssets: Asset[]
          borrowerSig: string[]
          debtHash: string
          interestHash: string
          collateralHash: string
          borrowerAddress: string
          orderNonceRaw: string
        }
        const preparedOrders: PreparedOrder[] = []

        for (const so of validOffchain) {
          const orderData = so.order.order_data
          const debtArr = (orderData.debtAssets ?? orderData.debt_assets) as Record<string, string>[] | undefined
          const interestArr = (orderData.interestAssets ?? orderData.interest_assets) as Record<string, string>[] | undefined
          const collateralArr = (orderData.collateralAssets ?? orderData.collateral_assets) as Record<string, string>[] | undefined
          const sdkDebtAssets = toSdkAssets(debtArr)
          const sdkInterestAssets = toSdkAssets(interestArr)
          const sdkCollateralAssets = toSdkAssets(collateralArr)

          const borrowerAddress = (orderData.borrower as string) || so.order.borrower
          const orderNonceRaw = String(orderData.nonce ?? so.order.nonce ?? '0')
          let orderHash = orderData.orderHash as string | undefined
          if (!orderHash) {
            const orderTypedData = getInscriptionOrderTypedData({
              borrower: borrowerAddress,
              debtAssets: sdkDebtAssets,
              interestAssets: sdkInterestAssets,
              collateralAssets: sdkCollateralAssets,
              debtCount: sdkDebtAssets.length,
              interestCount: sdkInterestAssets.length,
              collateralCount: sdkCollateralAssets.length,
              duration: BigInt(String(orderData.duration ?? '0')),
              deadline: BigInt(String(orderData.deadline ?? '0')),
              multiLender: Boolean(orderData.multiLender ?? orderData.multi_lender),
              nonce: BigInt(orderNonceRaw),
              chainId: CHAIN_ID,
            })
            orderHash = starknetTypedData.getMessageHash(orderTypedData, borrowerAddress)
          }

          const borrowerSig = parseSigToArray(so.order.borrower_signature as string | string[])
          const debtHash = (orderData.debtHash as string) || hashAssets(sdkDebtAssets)
          const interestHash = (orderData.interestHash as string) || hashAssets(sdkInterestAssets)
          const collateralHash = (orderData.collateralHash as string) || hashAssets(sdkCollateralAssets)

          preparedOrders.push({
            so, orderHash, sdkDebtAssets, sdkInterestAssets, sdkCollateralAssets,
            borrowerSig, debtHash, interestHash, collateralHash, borrowerAddress, orderNonceRaw,
          })
        }

        // 6. Sign ONE BatchLendOffer (covers all off-chain orders)
        let batchLenderSig: string[] = []
        let batchHash = '0x0'

        if (preparedOrders.length > 0) {
          // Build batch entries for hashing
          const batchEntries: BatchEntry[] = preparedOrders.map((p) => ({
            orderHash: p.orderHash,
            bps: BigInt(p.so.bps),
          }))
          batchHash = hashBatchEntries(batchEntries)

          const batchTypedData = getBatchLendOfferTypedData({
            batchHash,
            count: preparedOrders.length,
            lender: address,
            startNonce: lenderNonce,
            chainId: CHAIN_ID,
          })

          const signature = await signTypedData(batchTypedData)
          batchLenderSig = signature.map(String)
        }

        // 7. Verify lender nonce hasn't changed
        if (validOffchain.length > 0) {
          const currentNonce = await getNonce(provider, CONTRACT_ADDRESS, address)
          if (currentNonce !== lenderNonce) {
            throw new Error(
              `Your nonce changed during signing (was ${lenderNonce}, now ${currentNonce}). ` +
              `Another transaction may have been submitted. Please try again.`
            )
          }
        }

        // 8. Build unified multicall
        setState((s) => ({ ...s, phase: 'executing' }))

        // Build approve calls only if allowance is insufficient
        const allDebtTokenAddresses: string[] = []
        for (const p of preparedOrders) {
          for (const asset of p.sdkDebtAssets) {
            if (asset.asset_type === 'ERC20' || asset.asset_type === 'ERC4626') {
              allDebtTokenAddresses.push(asset.asset_address)
            }
          }
        }
        for (const so of onchainOrders) {
          const debtAssets = toSdkAssets(so.match.debtAssets as Record<string, string>[] | undefined)
          for (const asset of debtAssets) {
            if (asset.asset_type === 'ERC20' || asset.asset_type === 'ERC4626') {
              allDebtTokenAddresses.push(asset.asset_address)
            }
          }
        }

        // Add extra approval tokens (e.g. collateral for remainder inscription)
        if (options?.extraApproveAmounts) {
          for (const [, { address: tokenAddr }] of options.extraApproveAmounts) {
            allDebtTokenAddresses.push(tokenAddr)
          }
        }

        const uniqueTokens = [...new Set(allDebtTokenAddresses)]
        const approveCalls = await buildApprovalsIfNeeded(provider, address, uniqueTokens)

        // Build on-chain sign_inscription calls
        const onchainCalls = onchainOrders.map((so) => {
          const id = BigInt(so.match.id)
          return client.buildSignInscription(id, BigInt(so.bps))
        })

        // Build ONE batch_settle call for all off-chain orders (instead of N settle calls)
        const batchSettleCalls = preparedOrders.length > 0
          ? [client.buildBatchSettle({
              orders: preparedOrders.map((p) => {
                const orderData = p.so.order.order_data
                return {
                  borrower: p.borrowerAddress,
                  debtHash: p.debtHash,
                  interestHash: p.interestHash,
                  collateralHash: p.collateralHash,
                  debtCount: p.sdkDebtAssets.length,
                  interestCount: p.sdkInterestAssets.length,
                  collateralCount: p.sdkCollateralAssets.length,
                  duration: BigInt(String(orderData.duration ?? '0')),
                  deadline: BigInt(String(orderData.deadline ?? '0')),
                  multiLender: Boolean(orderData.multiLender ?? orderData.multi_lender),
                  nonce: BigInt(p.orderNonceRaw),
                }
              }),
              debtAssetsFlat: preparedOrders.flatMap((p) => p.sdkDebtAssets),
              interestAssetsFlat: preparedOrders.flatMap((p) => p.sdkInterestAssets),
              collateralAssetsFlat: preparedOrders.flatMap((p) => p.sdkCollateralAssets),
              borrowerSigs: preparedOrders.map((p) => p.borrowerSig),
              batchOffer: {
                batchHash,
                count: preparedOrders.length,
                lender: address,
                startNonce: lenderNonce,
              },
              lenderSig: batchLenderSig,
              bpsList: preparedOrders.map((p) => BigInt(p.so.bps)),
            })]
          : []

        // 9. Execute: approves → on-chain sign_inscription → batch_settle → extra calls
        const allCalls = [...approveCalls, ...onchainCalls, ...batchSettleCalls, ...(options?.extraCalls ?? [])]
        if (allCalls.length === 0) throw new Error('No settlement calls to execute')

        // Safety: ensure we have approve calls when there are settle calls
        if (approveCalls.length === 0 && (onchainCalls.length > 0 || batchSettleCalls.length > 0)) {
          console.warn('No approve calls generated — settlement may fail if allowance is insufficient')
        }

        toast.info('Confirm the settlement transaction in your wallet...')
        const { transaction_hash } = await account.execute(allCalls)

        setState((s) => ({ ...s, phase: 'confirming', txHash: transaction_hash }))
        toast.info('Waiting for transaction confirmation...')
        await provider.waitForTransaction(transaction_hash)

        // 10. Record off-chain settlements in backend (best-effort)
        setState((s) => ({ ...s, phase: 'recording' }))
        for (let i = 0; i < preparedOrders.length; i++) {
          const p = preparedOrders[i]
          const offerId = crypto.randomUUID()
          try {
            await fetch(`/api/orders/${p.so.order.id}/offer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: offerId,
                lender: address,
                bps: p.so.bps,
                lender_signature: batchLenderSig,
                nonce: (lenderNonce + BigInt(i)).toString(),
                tx_hash: transaction_hash,
              }),
            })
          } catch (err) {
            console.error(`Failed to record offer for order ${p.so.order.id}:`, err)
          }
        }

        const totalFeePercent = (totalValid * 5 / 100).toFixed(2)
        toast.success(`Settled ${totalValid} orders!`, {
          description: `${onchainOrders.length} on-chain + ${validOffchain.length} off-chain. Earned ${totalFeePercent}%. Tx: ${transaction_hash.slice(0, 16)}...`,
        })
        setState((s) => ({ ...s, phase: 'done' }))

        // Trigger data refresh across all hooks
        queryClient.invalidateQueries()
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        setState((s) => ({ ...s, phase: 'error', error: msg }))
        toast.error('Multi-settle failed', { description: msg })
        throw err
      } finally {
        pendingRef.current = false
      }
    },
    [address, account, signTypedData],
  )

  return { settleMultiple, state, reset }
}
