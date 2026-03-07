'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import type { Asset } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { getInscriptionOrderTypedData, getLendOfferTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { findDebtBalanceShortfall } from '@/lib/balance'
import type { TransactionProgress } from '@/hooks/useTransactionProgress'
import { useWalletSign } from '@/hooks/useWalletSign'
import { parseSigToArray } from '@/lib/signature'
import { toSdkAssets } from '@/lib/asset-conversion'

export function useSignOrder(orderId: string) {
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const signOrder = useCallback(
    async (bps: number, progress?: TransactionProgress) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
      progress?.start()
      try {
        // 1. Fetch order data
        const orderRes = await fetch(`/api/orders/${orderId}`)
        if (!orderRes.ok) throw new Error('Failed to fetch order')
        const orderWrapper = (await orderRes.json()) as { data: Record<string, unknown> }
        const order = orderWrapper.data
        const orderData =
          typeof order.order_data === 'string'
            ? (JSON.parse(order.order_data as string) as Record<string, unknown>)
            : (order.order_data as Record<string, unknown>)

        // 2. Self-lending check
        const borrowerAddr = (orderData.borrower as string).toLowerCase()
        if (borrowerAddr === address.toLowerCase()) {
          throw new Error('Cannot lend to your own order — connect a different wallet')
        }

        // 3. Get lender nonce from contract
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

        // 4. Verify borrower's nonce is still valid (order may be stale)
        //    Read twice with a short delay to defeat RPC caching
        const orderNonceRaw = String(orderData.nonce ?? order.nonce ?? '0')
        const orderNonce = BigInt(orderNonceRaw)
        const borrowerOnChainNonce = await getNonce(provider, CONTRACT_ADDRESS, orderData.borrower as string)

        if (borrowerOnChainNonce !== orderNonce) {
          throw new Error(
            `This order is stale — the borrower's on-chain nonce has changed ` +
            `(order has ${orderNonceRaw}, on-chain is ${borrowerOnChainNonce}). ` +
            `The borrower needs to create a new order.`
          )
        }

        // Also verify lender nonce matches what we'll use (prevents race with bot cron)
        // Re-read to confirm we have the latest value
        const lenderNonceRecheck = await getNonce(provider, CONTRACT_ADDRESS, address)
        if (lenderNonceRecheck !== nonce) {
          throw new Error(
            `Your nonce changed during signing (was ${nonce}, now ${lenderNonceRecheck}). ` +
            `Please try again.`
          )
        }

        // 5. Parse assets
        const debtArr = (orderData.debtAssets ?? orderData.debt_assets) as Record<string, string>[] | undefined
        const interestArr = (orderData.interestAssets ?? orderData.interest_assets) as Record<string, string>[] | undefined
        const collateralArr = (orderData.collateralAssets ?? orderData.collateral_assets) as Record<string, string>[] | undefined

        const sdkDebtAssets = toSdkAssets(debtArr)
        const sdkInterestAssets = toSdkAssets(interestArr)
        const sdkCollateralAssets = toSdkAssets(collateralArr)

        // 6. Compute order hash (reuse orderNonceRaw from step 4)
        let orderHash = orderData.orderHash as string | undefined
        if (!orderHash) {
          const orderTypedData = getInscriptionOrderTypedData({
            borrower: orderData.borrower as string,
            debtAssets: sdkDebtAssets,
            interestAssets: sdkInterestAssets,
            collateralAssets: sdkCollateralAssets,
            debtCount: sdkDebtAssets.length,
            interestCount: sdkInterestAssets.length,
            collateralCount: sdkCollateralAssets.length,
            duration: BigInt(orderData.duration as string),
            deadline: BigInt(orderData.deadline as string),
            multiLender: (orderData.multiLender ?? orderData.multi_lender) as boolean,
            nonce: BigInt(orderNonceRaw),
            chainId: CHAIN_ID,
          })
          orderHash = starknetTypedData.getMessageHash(orderTypedData, orderData.borrower as string)
        }

        await settlePublic({
          signTypedData, account, address, provider, nonce, orderHash, orderId, order, orderData,
          orderNonceRaw, sdkDebtAssets, sdkInterestAssets, sdkCollateralAssets,
          bps, progress,
        })
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        progress?.fail(msg)
        toast.error('Failed to settle', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, orderId, signTypedData],
  )

  return { signOrder, isPending }
}

// ---------------------------------------------------------------------------
// Public settlement flow: approve + settle directly from wallet
// ---------------------------------------------------------------------------

async function settlePublic(params: {
  signTypedData: (typedData: import('starknet').TypedData) => Promise<string[]>
  account: NonNullable<ReturnType<typeof useAccount>['account']>
  address: string
  provider: RpcProvider
  nonce: bigint
  orderHash: string
  orderId: string
  order: Record<string, unknown>
  orderData: Record<string, unknown>
  orderNonceRaw: string
  sdkDebtAssets: Asset[]
  sdkInterestAssets: Asset[]
  sdkCollateralAssets: Asset[]
  bps: number
  progress?: TransactionProgress
}) {
  const {
    signTypedData, account, address, provider, nonce, orderHash, orderId, order, orderData,
    orderNonceRaw, sdkDebtAssets, sdkInterestAssets, sdkCollateralAssets,
    bps, progress,
  } = params

  // 7. Build and sign LendOffer SNIP-12
  const typedData = getLendOfferTypedData({
    orderHash,
    lender: address,
    issuedDebtPercentage: BigInt(bps),
    nonce,
    chainId: CHAIN_ID,
  })

  const signature = await signTypedData(typedData)
  const lenderSig = signature.map(String)

  // 8. Parse borrower signature from stored order
  const borrowerSig = parseSigToArray(order.borrower_signature as string | string[])

  // 9. Compute asset hashes
  const debtHash = (orderData.debtHash as string) || hashAssets(sdkDebtAssets)
  const interestHash = (orderData.interestHash as string) || hashAssets(sdkInterestAssets)
  const collateralHash = (orderData.collateralHash as string) || hashAssets(sdkCollateralAssets)

  // 10. Pre-flight balance check (fail early with clear message)
  const shortfall = await findDebtBalanceShortfall(provider, address, sdkDebtAssets, bps)
  if (shortfall) {
    throw new Error(
      `Insufficient ${shortfall.symbol} balance. You need ${shortfall.neededFormatted} but only have ${shortfall.balanceFormatted}.`
    )
  }

  // 11. Build ERC20 approve calls for debt tokens (lender provides debt)
  const approveCalls = sdkDebtAssets
    .filter(a => a.asset_type === 'ERC20' || a.asset_type === 'ERC4626')
    .map(asset => {
      const amount = (asset.value * BigInt(bps)) / 10000n
      return {
        contractAddress: asset.asset_address,
        entrypoint: 'approve',
        calldata: [CONTRACT_ADDRESS, ...toU256(amount)],
      }
    })

  // 11. Build settle call using SDK
  const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
  const settleCall = client.buildSettle({
    order: {
      borrower: orderData.borrower as string,
      debtHash,
      interestHash,
      collateralHash,
      debtCount: sdkDebtAssets.length,
      interestCount: sdkInterestAssets.length,
      collateralCount: sdkCollateralAssets.length,
      duration: BigInt(orderData.duration as string),
      deadline: BigInt(orderData.deadline as string),
      multiLender: Boolean(orderData.multiLender ?? orderData.multi_lender),
      nonce: BigInt(orderNonceRaw),
    },
    debtAssets: sdkDebtAssets,
    interestAssets: sdkInterestAssets,
    collateralAssets: sdkCollateralAssets,
    borrowerSig,
    offer: {
      orderHash,
      lender: address,
      issuedDebtPercentage: BigInt(bps),
      nonce,
    },
    lenderSig,
  })

  // 12. Execute multicall: approve debt tokens + settle
  toast.info('Confirm the settlement transaction in your wallet...')
  const { transaction_hash } = await account.execute([...approveCalls, settleCall])

  // 13. Wait for on-chain confirmation
  progress?.advance()
  progress?.setTxHash(transaction_hash)
  toast.info('Waiting for transaction confirmation...')
  await provider.waitForTransaction(transaction_hash)

  // 14. Store offer in backend and mark as settled
  progress?.advance()
  const offerId = crypto.randomUUID()
  await fetch(`/api/orders/${orderId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: offerId,
      lender: address,
      bps,
      lender_signature: lenderSig,
      nonce: nonce.toString(),
      tx_hash: transaction_hash,
    }),
  })

  toast.success('Settlement complete!', {
    description: `Transaction: ${transaction_hash.slice(0, 16)}...`,
  })
  progress?.advance()
}
