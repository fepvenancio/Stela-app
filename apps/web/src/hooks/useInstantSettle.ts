'use client'

import { useCallback, useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, typedData as starknetTypedData } from 'starknet'
import { InscriptionClient, toU256 } from '@fepvenancio/stela-sdk'
import type { Asset } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { getInscriptionOrderTypedData, getLendOfferTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { findDebtBalanceShortfall } from '@/lib/balance'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import type { TransactionProgress } from '@/hooks/useTransactionProgress'
import { useWalletSign } from '@/hooks/useWalletSign'
import { parseSigToArray } from '@/lib/signature'
import { toSdkAssets } from '@/lib/asset-conversion'

export interface MatchedOrder {
  id: string
  borrower: string
  borrower_signature: string | string[]
  nonce: string
  deadline: number
  created_at: number
  order_data: Record<string, unknown>
}

/**
 * Hook for instantly settling a matched order.
 * The user acts as LENDER on the matched order (not posting their own order).
 * The user earns the 5 BPS relayer fee by calling settle() themselves.
 */
export function useInstantSettle() {
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const settle = useCallback(
    async (matchedOrder: MatchedOrder, progress?: TransactionProgress) => {
      if (!address || !account) throw new Error('Wallet not connected')

      setIsPending(true)
      progress?.start()
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        const orderData = matchedOrder.order_data

        // 1. Deadline + self-lending checks
        const nowSeconds = Math.floor(Date.now() / 1000)
        if (matchedOrder.deadline <= nowSeconds) {
          throw new Error('This order has expired — the deadline has passed.')
        }

        const borrowerAddr = (orderData.borrower as string || matchedOrder.borrower).toLowerCase()
        if (borrowerAddr === address.toLowerCase()) {
          throw new Error('Cannot lend to your own order')
        }

        // 2. Get lender nonce (our nonce)
        const lenderNonce = await getNonce(provider, CONTRACT_ADDRESS, address)

        // 3. Verify borrower nonce is still valid
        const orderNonceRaw = String(orderData.nonce ?? matchedOrder.nonce ?? '0')
        const orderNonce = BigInt(orderNonceRaw)
        const borrowerOnChainNonce = await getNonce(
          provider, CONTRACT_ADDRESS,
          (orderData.borrower as string) || matchedOrder.borrower,
        )

        if (borrowerOnChainNonce !== orderNonce) {
          throw new Error(
            `This order is stale — the borrower's on-chain nonce has changed ` +
            `(order has ${orderNonceRaw}, on-chain is ${borrowerOnChainNonce}). ` +
            `This match is no longer valid.`
          )
        }

        // 4. Parse assets from matched order
        const debtArr = (orderData.debtAssets ?? orderData.debt_assets) as Record<string, string>[] | undefined
        const interestArr = (orderData.interestAssets ?? orderData.interest_assets) as Record<string, string>[] | undefined
        const collateralArr = (orderData.collateralAssets ?? orderData.collateral_assets) as Record<string, string>[] | undefined

        const sdkDebtAssets = toSdkAssets(debtArr)
        const sdkInterestAssets = toSdkAssets(interestArr)
        const sdkCollateralAssets = toSdkAssets(collateralArr)

        // 5. Compute order hash
        const borrowerAddress = (orderData.borrower as string) || matchedOrder.borrower
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

        // 6. Sign LendOffer (we are the lender at 100% BPS)
        const bps = 10000
        const lendOfferTypedData = getLendOfferTypedData({
          orderHash,
          lender: address,
          issuedDebtPercentage: BigInt(bps),
          nonce: lenderNonce,
          chainId: CHAIN_ID,
        })

        const signature = await signTypedData(lendOfferTypedData)
        const lenderSig = signature.map(String)
        progress?.advance()

        // 7. Parse borrower signature
        const borrowerSig = parseSigToArray(matchedOrder.borrower_signature as string | string[])

        // 8. Compute asset hashes
        const debtHash = (orderData.debtHash as string) || hashAssets(sdkDebtAssets)
        const interestHash = (orderData.interestHash as string) || hashAssets(sdkInterestAssets)
        const collateralHash = (orderData.collateralHash as string) || hashAssets(sdkCollateralAssets)

        // 9. Pre-flight balance check (we need to provide the DEBT tokens as lender)
        const shortfall = await findDebtBalanceShortfall(provider, address, sdkDebtAssets, bps)
        if (shortfall) {
          throw new Error(
            `Insufficient ${shortfall.symbol} balance. You need ${shortfall.neededFormatted} but only have ${shortfall.balanceFormatted}.`
          )
        }

        // 10. Build approve calls for debt tokens (we are lending these)
        // Check existing allowance and only approve if needed (prevents wasted gas)
        const approveCalls: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
        for (const asset of sdkDebtAssets) {
          if (asset.asset_type !== 'ERC20' && asset.asset_type !== 'ERC4626') continue
          const needed = (asset.value * BigInt(bps) + 9999n) / 10000n
          if (needed === 0n) continue
          let currentAllowance = 0n
          try {
            const result = await provider.callContract({
              contractAddress: asset.asset_address,
              entrypoint: 'allowance',
              calldata: [address, CONTRACT_ADDRESS],
            })
            currentAllowance = BigInt(result[0]) + (BigInt(result[1] ?? '0') << 128n)
          } catch { /* default to 0, will approve */ }
          if (currentAllowance < needed) {
            approveCalls.push({
              contractAddress: asset.asset_address,
              entrypoint: 'approve',
              calldata: [CONTRACT_ADDRESS, ...toU256(needed)],
            })
          }
        }

        // 11. Build settle call
        const client = new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
        const settleCall = client.buildSettle({
          order: {
            borrower: borrowerAddress,
            debtHash,
            interestHash,
            collateralHash,
            debtCount: sdkDebtAssets.length,
            interestCount: sdkInterestAssets.length,
            collateralCount: sdkCollateralAssets.length,
            duration: BigInt(String(orderData.duration ?? '0')),
            deadline: BigInt(String(orderData.deadline ?? '0')),
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
            nonce: lenderNonce,
          },
          lenderSig,
        })

        // 12. Execute multicall: approve + settle
        toast.info('Confirm the settlement transaction in your wallet...')
        const { transaction_hash } = await account.execute([...approveCalls, settleCall])

        progress?.advance()
        progress?.setTxHash(transaction_hash)
        toast.info('Waiting for transaction confirmation...')
        await provider.waitForTransaction(transaction_hash)

        // 13. Record settlement in backend
        progress?.advance()
        const offerId = crypto.randomUUID()
        const offerRes = await fetch(`/api/orders/${matchedOrder.id}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: offerId,
            lender: address,
            bps,
            lender_signature: lenderSig,
            nonce: lenderNonce.toString(),
            tx_hash: transaction_hash,
          }),
        })

        if (!offerRes.ok) {
          // Settlement succeeded on-chain even if API update fails
          console.error('Failed to update API after settlement:', await offerRes.text())
        }

        toast.success('Instant settlement complete!', {
          description: `You earned the 0.05% relayer fee. Tx: ${transaction_hash.slice(0, 16)}...`,
        })
        progress?.advance()

        // Trigger data refresh across all hooks
        window.dispatchEvent(new Event('stela:sync'))
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        progress?.fail(msg)
        toast.error('Failed to settle', { description: msg })
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [address, account, signTypedData],
  )

  return { settle, isPending }
}
