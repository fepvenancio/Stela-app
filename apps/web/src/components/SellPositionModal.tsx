'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { normalizeAddress } from '@/lib/address'
import { parseAmount } from '@/lib/amount'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import type { StepDefinition } from '@/hooks/useTransactionProgress'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { ensureStarknetContext } from '@/hooks/ensure-context'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SellPositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inscriptionId: string
  maxShares: bigint
  debtAssets: { address: string; value: string }[]
}

const SELL_STEPS: StepDefinition[] = [
  { label: 'Create listing', description: 'Saving your listing details' },
  { label: 'Done', description: 'Listing is now active' },
]

const DURATION_OPTIONS = [
  { value: '3600', label: '1 hour' },
  { value: '86400', label: '1 day' },
  { value: '259200', label: '3 days' },
  { value: '604800', label: '7 days' },
]

export function SellPositionModal({
  open,
  onOpenChange,
  inscriptionId,
  maxShares,
  debtAssets,
}: SellPositionModalProps) {
  const { address, status } = useAccount()
  const queryClient = useQueryClient()
  const progress = useTransactionProgress(SELL_STEPS)

  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('86400')
  const [submitting, setSubmitting] = useState(false)

  const primaryDebt = debtAssets[0]
  const debtToken = primaryDebt ? findTokenByAddress(primaryDebt.address) : undefined
  const paymentSymbol = debtToken?.symbol ?? 'TOKEN'
  const paymentDecimals = debtToken?.decimals ?? 18

  const parsedShares = useMemo(() => {
    try {
      const n = BigInt(shares || '0')
      return n > 0n && n <= maxShares ? n : 0n
    } catch {
      return 0n
    }
  }, [shares, maxShares])

  const parsedPrice = useMemo(() => {
    try {
      return parseAmount(price, paymentDecimals)
    } catch {
      return 0n
    }
  }, [price, paymentDecimals])

  const canSubmit = parsedShares > 0n && parsedPrice > 0n && !submitting && !progress.open

  const handleMax = useCallback(() => {
    setShares(maxShares.toString())
  }, [maxShares])

  const handleSell = useCallback(async () => {
    ensureStarknetContext({ address, status })
    if (!primaryDebt) return

    setSubmitting(true)
    progress.start()

    try {
      const deadline = Math.floor(Date.now() / 1000) + Number(duration)

      const res = await fetch('/api/share-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscription_id: inscriptionId,
          seller: normalizeAddress(address!),
          shares: parsedShares.toString(),
          payment_token: normalizeAddress(primaryDebt.address),
          price: parsedPrice.toString(),
          deadline,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((err as { error: string }).error || `HTTP ${res.status}`)
      }

      progress.advance() // listing created
      progress.advance() // done

      toast.success('Listing created')
      queryClient.invalidateQueries()

      // Reset form
      setShares('')
      setPrice('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      progress.fail(msg)
      toast.error(`Failed to list: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }, [address, status, inscriptionId, primaryDebt, parsedShares, parsedPrice, duration, progress])

  return (
    <>
      <Dialog open={open && !progress.open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-void border-edge/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
              Sell Position
            </DialogTitle>
            <DialogDescription className="text-dust text-xs">
              List your ERC1155 lending shares for sale. Buyers pay in {paymentSymbol}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Balance */}
            <div className="flex items-center justify-between p-3 bg-surface/20 border border-edge/20 rounded-xl">
              <span className="text-[10px] text-dust uppercase tracking-widest">Your Shares</span>
              <span className="text-sm text-chalk font-mono">{maxShares.toString()}</span>
            </div>

            {/* Shares */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest">Shares to Sell</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
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
              {shares && parsedShares === 0n && (
                <span className="text-[10px] text-nova">
                  Enter a value between 1 and {maxShares.toString()}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest">
                Ask Price ({paymentSymbol})
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.000"
                value={price}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) setPrice(v)
                }}
                className="font-mono text-xs"
              />
              {price && parsedPrice === 0n && (
                <span className="text-[10px] text-nova">Enter a valid price</span>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-[10px] text-dust uppercase tracking-widest">Listing Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 bg-surface/30 border-edge/40 text-xs text-dust hover:text-chalk rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-void border-edge">
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-xl border-edge/50 text-dust hover:text-chalk hover:border-edge"
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleSell}
              disabled={!canSubmit}
              className="px-6 rounded-xl font-bold shadow-lg shadow-star/20"
            >
              {submitting ? 'Listing...' : 'List for Sale'}
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
