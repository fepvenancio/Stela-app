'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import type { AssetType } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { getInscriptionOrderTypedData, getLendOfferTypedData, getNonce } from '@/lib/offchain'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

export function useSignOrder(orderId: string) {
  const { address, account } = useAccount()
  const [isPending, setIsPending] = useState(false)

  const signOrder = useCallback(
    async (bps: number) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
      try {
        // Fetch the order to get the order data
        const orderRes = await fetch(`/api/orders/${orderId}`)
        if (!orderRes.ok) throw new Error('Failed to fetch order')
        const orderWrapper = (await orderRes.json()) as { data: Record<string, unknown> }
        const order = orderWrapper.data
        const orderData =
          typeof order.order_data === 'string'
            ? (JSON.parse(order.order_data as string) as Record<string, unknown>)
            : (order.order_data as Record<string, unknown>)

        // Get nonce from contract
        const provider = new RpcProvider({ nodeUrl: RPC_URL, blockIdentifier: 'latest' })
        const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

        // Compute the SNIP-12 message hash of the InscriptionOrder.
        // If the API stored it, use that; otherwise recompute from order data.
        let orderHash = orderData.orderHash as string | undefined
        if (!orderHash) {
          // Reconstruct typed data from stored order data to compute the message hash
          const toSdkAssets = (arr: Record<string, string>[] | undefined) =>
            (arr || []).map((a) => ({
              asset_address: a.asset_address,
              asset_type: a.asset_type as AssetType,
              value: BigInt(a.value),
              token_id: BigInt(a.token_id ?? '0'),
            }))

          // Handle both camelCase and snake_case keys
          const debtArr = (orderData.debtAssets ?? orderData.debt_assets) as Record<string, string>[] | undefined
          const interestArr = (orderData.interestAssets ?? orderData.interest_assets) as Record<string, string>[] | undefined
          const collateralArr = (orderData.collateralAssets ?? orderData.collateral_assets) as Record<string, string>[] | undefined

          const sdkDebtAssets = toSdkAssets(debtArr)
          const sdkInterestAssets = toSdkAssets(interestArr)
          const sdkCollateralAssets = toSdkAssets(collateralArr)

          const orderNonce = String(orderData.nonce ?? order.nonce ?? '0')

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
            nonce: BigInt(orderNonce),
            chainId: 'SN_SEPOLIA',
          })

          orderHash = starknetTypedData.getMessageHash(orderTypedData, orderData.borrower as string)
        }

        const typedData = getLendOfferTypedData({
          orderHash,
          lender: address,
          issuedDebtPercentage: BigInt(bps),
          nonce,
          chainId: 'SN_SEPOLIA',
        })

        // Sign off-chain
        const signature = await account.signMessage(typedData)

        // POST offer to backend
        const offerId = crypto.randomUUID()
        const response = await fetch(`/api/orders/${orderId}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: offerId,
            lender: address,
            bps,
            lender_signature: Array.isArray(signature) ? signature : [signature.r, signature.s],
            nonce: nonce.toString(),
          }),
        })

        if (!response.ok) {
          const err = (await response.json()) as Record<string, string>
          throw new Error(err.error || 'Failed to submit offer')
        }

        toast.success('Offer signed & submitted', {
          description: 'Your lending offer has been recorded. The bot will settle it on-chain shortly.',
        })
      } catch (err: unknown) {
        toast.error('Failed to sign offer', { description: getErrorMessage(err) })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, orderId],
  )

  return { signOrder, isPending }
}
