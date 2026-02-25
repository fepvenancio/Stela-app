'use client'

import { useState, useMemo } from 'react'
import { useAccount } from '@starknet-react/core'
import type { TakerIntent, SignedOrder } from '@fepvenancio/stela-sdk'
import { useSubmitSignedOrder } from '@/hooks/useSubmitSignedOrder'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface MakerOrderFormProps {
  intent: TakerIntent | null
  onSuccess: () => void
  onBack: () => void
}

const ACTION_LABELS: Record<string, string> = {
  Borrow: 'Lending (counterpart to Borrow intent)',
  Lend: 'Borrowing (counterpart to Lend intent)',
}

function generateNonce(): string {
  return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function defaultDeadline(): string {
  return Math.floor(Date.now() / 1000 + 7 * 86400).toString()
}

/**
 * MakerOrderForm — create a signed maker order when no match is found.
 * Pre-populates from the taker's intent parameters and uses SNIP-12
 * signing via useSubmitSignedOrder.
 */
export function MakerOrderForm({ intent, onSuccess, onBack }: MakerOrderFormProps) {
  const { address } = useAccount()
  const { submit, isPending, error } = useSubmitSignedOrder()

  // Pre-populated from intent
  const [inscriptionId, setInscriptionId] = useState(intent?.inscription_id ?? '')
  const [bps, setBps] = useState(intent?.bps?.toString() ?? '')

  // Additional maker fields
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [nonce] = useState(generateNonce)
  const [minFillBps, setMinFillBps] = useState('1000')
  const [allowedTaker, setAllowedTaker] = useState('0x0')
  const [validationError, setValidationError] = useState<string | null>(null)

  const counterpartAction = intent ? ACTION_LABELS[intent.action] ?? intent.action : 'Unknown'

  const deadlineDate = useMemo(() => {
    const ts = Number(deadline)
    if (isNaN(ts) || ts <= 0) return 'Invalid'
    return new Date(ts * 1000).toLocaleString()
  }, [deadline])

  async function handleSubmit() {
    setValidationError(null)

    if (!address) {
      setValidationError('Wallet not connected')
      return
    }

    if (!inscriptionId.trim()) {
      setValidationError('Inscription ID is required')
      return
    }

    const bpsNum = Number(bps)
    if (!bps || isNaN(bpsNum) || bpsNum < 1 || bpsNum > 10000) {
      setValidationError('BPS must be between 1 and 10000')
      return
    }

    const minFillNum = Number(minFillBps)
    if (isNaN(minFillNum) || minFillNum < 0 || minFillNum > 10000) {
      setValidationError('Min fill BPS must be between 0 and 10000')
      return
    }

    const deadlineNum = Number(deadline)
    if (isNaN(deadlineNum) || deadlineNum <= Math.floor(Date.now() / 1000)) {
      setValidationError('Deadline must be in the future')
      return
    }

    const order: SignedOrder = {
      maker: address,
      allowed_taker: allowedTaker.trim() || '0x0',
      inscription_id: inscriptionId.trim(),
      bps: bpsNum.toString(),
      deadline: deadlineNum,
      nonce,
      min_fill_bps: minFillNum.toString(),
    }

    try {
      await submit(order)
      toast.success('Maker order created!', {
        description: 'Your signed order is now available for takers.',
      })
      onSuccess()
    } catch {
      // Error is already set in the hook
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
          Create a Maker Order
        </h3>
        <p className="text-xs text-dust">
          No matching orders found. Create one for others to fill.
        </p>
      </div>

      {/* Counterpart action info */}
      <div className="rounded-xl border border-edge/20 bg-surface/20 p-4">
        <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Action</span>
        <span className="text-xs text-chalk">{counterpartAction}</span>
      </div>

      {/* Pre-populated fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Inscription ID
          </Label>
        </div>
        <Input
          value={inscriptionId}
          onChange={(e) => setInscriptionId(e.target.value)}
          placeholder="0x..."
          className="bg-surface/50 border-edge/50 focus:border-star font-mono"
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            BPS Amount
          </Label>
        </div>
        <Input
          type="number"
          value={bps}
          onChange={(e) => setBps(e.target.value)}
          placeholder="10000"
          min={1}
          max={10000}
          className="bg-surface/50 border-edge/50 focus:border-star"
        />
      </div>

      {/* Additional maker fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Deadline
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            Unix timestamp for order expiry — {deadlineDate}
          </p>
        </div>
        <Input
          type="number"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="bg-surface/50 border-edge/50 focus:border-star font-mono"
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Nonce
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            Auto-generated replay protection nonce (read-only)
          </p>
        </div>
        <Input
          value={nonce}
          readOnly
          className="bg-surface/30 border-edge/30 text-ash font-mono cursor-not-allowed"
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Min Fill BPS
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            Minimum fill amount. Default 1000 = 10%.
          </p>
        </div>
        <Input
          type="number"
          value={minFillBps}
          onChange={(e) => setMinFillBps(e.target.value)}
          min={0}
          max={10000}
          className="bg-surface/50 border-edge/50 focus:border-star"
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Allowed Taker
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            Restrict to specific taker address. 0x0 = any taker.
          </p>
        </div>
        <Input
          value={allowedTaker}
          onChange={(e) => setAllowedTaker(e.target.value)}
          placeholder="0x0"
          className="bg-surface/50 border-edge/50 focus:border-star font-mono"
        />
      </div>

      {/* Errors */}
      {(validationError || error) && (
        <p className="text-xs text-nova">{validationError || error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 h-14 text-ash hover:text-chalk uppercase tracking-widest"
        >
          Back
        </Button>
        <Web3ActionWrapper message="Connect wallet to sign order">
          <Button
            variant="gold"
            size="xl"
            className="flex-1 h-14 text-base uppercase tracking-widest"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Signing...' : 'Sign & Submit'}
          </Button>
        </Web3ActionWrapper>
      </div>
    </div>
  )
}
