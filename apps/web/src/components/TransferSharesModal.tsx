'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { addressesEqual } from '@/lib/address'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TransferSharesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inscriptionId: string
  maxShares: bigint
}

const VALID_STARKNET_ADDRESS = /^0x[0-9a-fA-F]{1,64}$/

const TRANSFER_STEPS: StepDefinition[] = [
  { label: 'Transfer shares', description: 'Sending ERC1155 safe_transfer_from' },
  { label: 'Confirm on-chain', description: 'Waiting for transaction confirmation' },
]

export function TransferSharesModal({ open, onOpenChange, inscriptionId, maxShares }: TransferSharesModalProps) {
  const { address, status } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const { sync } = useSync()
  const progress = useTransactionProgress(TRANSFER_STEPS)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  const recipientValid = VALID_STARKNET_ADDRESS.test(recipient)
  const isSelfTransfer = recipientValid && !!address && addressesEqual(recipient, address)
  const parsedAmount = useMemo(() => {
    try {
      const n = BigInt(amount || '0')
      return n > 0n && n <= maxShares ? n : 0n
    } catch {
      return 0n
    }
  }, [amount, maxShares])

  const canSubmit = recipientValid && !isSelfTransfer && parsedAmount > 0n && !isPending && !progress.open

  const handleMax = useCallback(() => {
    setAmount(maxShares.toString())
  }, [maxShares])

  const handleTransfer = useCallback(async () => {
    ensureStarknetContext({ address, status })

    progress.start()

    try {
      const call = {
        contractAddress: CONTRACT_ADDRESS,
        entrypoint: 'safe_transfer_from',
        calldata: [
          address!,
          recipient,
          ...toU256(BigInt(inscriptionId)),
          ...toU256(parsedAmount),
          '0', // empty data span length
        ],
      }

      const result = await sendAsync([call])
      progress.setTxHash(result.transaction_hash)
      progress.advance() // transfer sent

      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      await provider.waitForTransaction(result.transaction_hash)
      progress.advance() // confirmed

      toast.success('Shares transferred')
      sync(result.transaction_hash).catch(() => {})

      // Reset form
      setRecipient('')
      setAmount('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      progress.fail(msg)
    }
  }, [address, status, recipient, inscriptionId, parsedAmount, sendAsync, progress, sync])

  return (
    <>
      <Dialog open={open && !progress.open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-void border-edge/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
              Transfer Shares
            </DialogTitle>
            <DialogDescription className="text-dust text-xs">
              Send ERC1155 shares to another address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current Balance */}
            <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
              <span className="text-[10px] text-dust uppercase tracking-widest">Your Balance</span>
              <span className="text-sm text-chalk font-mono">{maxShares.toString()} shares</span>
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest">Recipient Address</Label>
              <Input
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono text-xs"
                aria-invalid={recipient.length > 0 && !recipientValid}
              />
              {recipient.length > 0 && !recipientValid && (
                <span className="text-[10px] text-nova">Invalid StarkNet address</span>
              )}
              {isSelfTransfer && (
                <span className="text-[10px] text-nova">Cannot transfer to yourself</span>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest">Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max={maxShares.toString()}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  className="shrink-0 rounded-lg border-edge/50 text-dust hover:text-star hover:border-star/30 text-[10px] uppercase tracking-widest"
                >
                  Max
                </Button>
              </div>
              {amount && parsedAmount === 0n && (
                <span className="text-[10px] text-nova">
                  Enter a value between 1 and {maxShares.toString()}
                </span>
              )}
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
              onClick={handleTransfer}
              disabled={!canSubmit}
              className="px-6 rounded-xl font-bold shadow-lg shadow-star/20"
            >
              {isPending ? 'Processing...' : 'Transfer'}
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
