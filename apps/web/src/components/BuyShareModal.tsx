'use client'

import { useCallback } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256, findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeAddress } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import type { StepDefinition } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { ensureStarknetContext } from '@/hooks/ensure-context'
import { useSync } from '@/hooks/useSync'
import { RpcProvider } from 'starknet'
import { RPC_URL } from '@/lib/config'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ShareListing {
  id: string
  inscription_id: string
  seller: string
  shares: string
  payment_token: string
  price: string
  status: string
  deadline: number
}

interface BuyShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listing: ShareListing
}

const BUY_STEPS: StepDefinition[] = [
  { label: 'Approve payment', description: 'Approve token transfer to seller' },
  { label: 'Send payment', description: 'Transferring payment to seller' },
  { label: 'Confirm on-chain', description: 'Waiting for block confirmation' },
  { label: 'Mark filled', description: 'Recording the purchase' },
]

export function BuyShareModal({ open, onOpenChange, listing }: BuyShareModalProps) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const { sync } = useSync()
  const progress = useTransactionProgress(BUY_STEPS)

  const paymentToken = findTokenByAddress(listing.payment_token)
  const paymentSymbol = paymentToken?.symbol ?? 'TOKEN'
  const paymentDecimals = paymentToken?.decimals ?? 18
  const formattedPrice = formatTokenValue(listing.price, paymentDecimals)

  const handleBuy = useCallback(async () => {
    ensureStarknetContext({ address, status })

    progress.start()

    try {
      // Step 1: Approve payment token transfer to seller
      const approveCall = {
        contractAddress: listing.payment_token,
        entrypoint: 'approve',
        calldata: [listing.seller, ...toU256(BigInt(listing.price))],
      }

      // Step 2: Transfer payment to seller
      const transferCall = {
        contractAddress: listing.payment_token,
        entrypoint: 'transfer',
        calldata: [listing.seller, ...toU256(BigInt(listing.price))],
      }

      // Execute approve + transfer in single multicall
      const result = await sendAsync([approveCall, transferCall])
      progress.setTxHash(result.transaction_hash)
      progress.advance() // approve done
      progress.advance() // payment sent

      // Step 3: Wait for on-chain confirmation
      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      await provider.waitForTransaction(result.transaction_hash)
      progress.advance() // confirmed

      // Step 4: Mark listing as filled
      const fillRes = await fetch(`/api/share-listings/${listing.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer: normalizeAddress(address!),
          tx_hash: result.transaction_hash,
        }),
      })

      if (!fillRes.ok) {
        const err = await fillRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((err as { error: string }).error || `HTTP ${fillRes.status}`)
      }

      progress.advance() // filled

      toast.success('Shares purchased! The seller will transfer your shares.')
      sync(result.transaction_hash).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      progress.fail(msg)
    }
  }, [address, status, listing, sendAsync, progress, sync])

  const expired = listing.deadline < Math.floor(Date.now() / 1000)

  return (
    <>
      <Dialog open={open && !progress.open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-void border-edge/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
              Buy Shares
            </DialogTitle>
            <DialogDescription className="text-dust text-xs">
              Purchase lending shares from this listing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
              <span className="text-[10px] text-dust uppercase tracking-widest">Shares</span>
              <span className="text-sm text-chalk font-mono">{listing.shares}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
              <span className="text-[10px] text-dust uppercase tracking-widest">Price</span>
              <span className="text-sm text-chalk font-mono">{formattedPrice} {paymentSymbol}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
              <span className="text-[10px] text-dust uppercase tracking-widest">Seller</span>
              <span className="text-xs text-chalk font-mono">
                {listing.seller.slice(0, 8)}...{listing.seller.slice(-4)}
              </span>
            </div>

            {expired && (
              <div className="p-3 bg-nova/5 border border-nova/20 rounded-xl">
                <span className="text-xs text-nova">This listing has expired.</span>
              </div>
            )}

            <div className="p-3 bg-star/5 border border-star/10 rounded-xl">
              <p className="text-[10px] text-dust">
                You will send <span className="text-star font-mono">{formattedPrice} {paymentSymbol}</span> to
                the seller. Once confirmed, the seller will transfer shares to your wallet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="rounded-xl border-edge/50 text-dust hover:text-chalk hover:border-edge"
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleBuy}
              disabled={isPending || expired || progress.open}
              className="px-6 rounded-xl font-bold shadow-lg shadow-star/20"
            >
              {isPending ? 'Processing...' : `Pay ${formattedPrice} ${paymentSymbol}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionProgressModal
        open={progress.open}
        steps={progress.steps}
        txHash={progress.txHash}
        onClose={() => {
          progress.close()
          onOpenChange(false)
        }}
      />
    </>
  )
}
