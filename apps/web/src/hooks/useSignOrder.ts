'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import type { AssetType, Asset } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { getInscriptionOrderTypedData, getLendOfferTypedData, hashAssets, getNonce, createPrivateNote, generateSalt } from '@/lib/offchain'
import { savePrivateNote } from '@/lib/private-notes'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

function toSdkAssets(arr: Record<string, string>[] | undefined): Asset[] {
  return (arr || []).map((a) => ({
    asset_address: a.asset_address,
    asset_type: a.asset_type as AssetType,
    value: BigInt(a.value),
    token_id: BigInt(a.token_id ?? '0'),
  }))
}

function parseSigToArray(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) return JSON.parse(raw) as string[]
    if (raw.startsWith('{')) {
      const obj = JSON.parse(raw) as { r: string; s: string }
      return [obj.r, obj.s]
    }
    return raw.split(',')
  }
  throw new Error('Invalid signature format')
}

function formatSig(signature: unknown): string[] {
  if (Array.isArray(signature)) {
    return signature.map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s))
  }
  const sig = signature as { r: unknown; s: unknown }
  return [sig.r, sig.s].map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s))
}

export function useSignOrder(orderId: string) {
  const { address, account } = useAccount()
  const [isPending, setIsPending] = useState(false)

  const signOrder = useCallback(
    async (bps: number, privateMode = false) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
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

        // 2. Get lender nonce from contract
        const provider = new RpcProvider({ nodeUrl: RPC_URL, blockIdentifier: 'latest' })
        const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

        // 3. Parse assets
        const debtArr = (orderData.debtAssets ?? orderData.debt_assets) as Record<string, string>[] | undefined
        const interestArr = (orderData.interestAssets ?? orderData.interest_assets) as Record<string, string>[] | undefined
        const collateralArr = (orderData.collateralAssets ?? orderData.collateral_assets) as Record<string, string>[] | undefined

        const sdkDebtAssets = toSdkAssets(debtArr)
        const sdkInterestAssets = toSdkAssets(interestArr)
        const sdkCollateralAssets = toSdkAssets(collateralArr)

        // 4. Compute order hash
        const orderNonce = String(orderData.nonce ?? order.nonce ?? '0')
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
            nonce: BigInt(orderNonce),
            chainId: 'SN_SEPOLIA',
          })
          orderHash = starknetTypedData.getMessageHash(orderTypedData, orderData.borrower as string)
        }

        // 5. Generate private commitment if privateMode is on
        const sharesAmount = BigInt(bps) // shares proportional to BPS
        const privateNote = privateMode
          ? createPrivateNote(address, 0n, sharesAmount, generateSalt())
          : null
        const lenderCommitment = privateNote ? privateNote.commitment : undefined

        // 6. Build and sign LendOffer SNIP-12
        const typedData = getLendOfferTypedData({
          orderHash,
          lender: address,
          issuedDebtPercentage: BigInt(bps),
          nonce,
          chainId: 'SN_SEPOLIA',
          lenderCommitment,
        })

        const signature = await account.signMessage(typedData)
        const lenderSig = formatSig(signature)

        // 6. Parse borrower signature from stored order
        const borrowerSig = parseSigToArray(order.borrower_signature as string | string[])

        // 7. Compute asset hashes
        const debtHash = (orderData.debtHash as string) || hashAssets(sdkDebtAssets)
        const interestHash = (orderData.interestHash as string) || hashAssets(sdkInterestAssets)
        const collateralHash = (orderData.collateralHash as string) || hashAssets(sdkCollateralAssets)

        // 8. Build ERC20 approve calls for debt tokens (lender provides debt)
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

        // 9. Build settle call using SDK
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
            nonce: BigInt(orderNonce),
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
            lenderCommitment,
          },
          lenderSig,
        })

        // 10. Execute multicall: approve debt tokens + settle
        toast.info('Confirm the settlement transaction in your wallet...')
        const { transaction_hash } = await account.execute([...approveCalls, settleCall])

        // 11. Wait for on-chain confirmation
        toast.info('Waiting for transaction confirmation...')
        await provider.waitForTransaction(transaction_hash)

        // 12. Store offer in backend and mark as settled
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
            lender_commitment: lenderCommitment ?? '0x0',
          }),
        })

        // Save private note to localStorage
        if (privateNote) {
          savePrivateNote(privateNote, orderId)
          toast.success('Private settlement complete!', {
            description: 'Private note saved — back it up to redeem later',
          })
        } else {
          toast.success('Settlement complete!', {
            description: `Transaction: ${transaction_hash.slice(0, 16)}...`,
          })
        }
      } catch (err: unknown) {
        toast.error('Failed to settle', { description: getErrorMessage(err) })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, orderId],
  )

  return { signOrder, isPending }
}
