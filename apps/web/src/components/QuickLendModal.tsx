'use client'

import { useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import { RpcProvider } from 'starknet'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { Asset } from '@fepvenancio/stela-sdk'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FeeBreakdown } from '@/components/FeeBreakdown'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { useWalletSign } from '@/hooks/useWalletSign'
import { getInscriptionOrderTypedData, hashAssets, getNonce } from '@/lib/offchain'
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from '@/lib/config'
import { parseAmount } from '@/lib/amount'
import { formatAddress } from '@/lib/address'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

// Duration presets matching useOrderForm pattern
const DURATION_PRESETS = [
  { label: '1 Day', value: '86400' },
  { label: '7 Days', value: '604800' },
  { label: '30 Days', value: '2592000' },
  { label: '90 Days', value: '7776000' },
]
const DEFAULT_DURATION = '86400'
const DEFAULT_DEADLINE_OFFSET = '604800' // 7 days

interface QuickLendModalProps {
  open: boolean
  onClose: () => void
  debtToken: string
  collateralToken: string
}

export function QuickLendModal({ open, onClose, debtToken, collateralToken }: QuickLendModalProps) {
  const { address, account } = useAccount()
  const { signTypedData } = useWalletSign()
  const [amount, setAmount] = useState('')
  const [durationPreset, setDurationPreset] = useState(DEFAULT_DURATION)
  const [isPending, setIsPending] = useState(false)

  const debtInfo = findTokenByAddress(debtToken)
  const collateralInfo = findTokenByAddress(collateralToken)
  const debtSymbol = debtInfo?.symbol ?? formatAddress(debtToken)
  const collSymbol = collateralInfo?.symbol ?? formatAddress(collateralToken)
  const debtDecimals = debtInfo?.decimals ?? 18

  // Per UI-SPEC copywriting: modal title = "Lend {debtSymbol} / {collSymbol}"
  const title = `Lend ${debtSymbol} / ${collSymbol}`

  const handleSign = async () => {
    if (!address || !account) {
      toast.error('Connect your wallet first')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setIsPending(true)
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      const nonce = await getNonce(provider, CONTRACT_ADDRESS, address)

      // Build debt asset from amount
      const rawAmount = parseAmount(amount, debtDecimals)
      const debtAssets: Asset[] = [{
        asset_address: debtToken,
        asset_type: 'ERC20',
        value: rawAmount,
        token_id: 0n,
      }]

      // Build order typed data for SNIP-12 signing
      const deadline = Math.floor(Date.now() / 1000) + Number(DEFAULT_DEADLINE_OFFSET)
      const typedData = getInscriptionOrderTypedData({
        borrower: address,
        debtAssets,
        interestAssets: [],
        collateralAssets: [],
        debtCount: debtAssets.length,
        interestCount: 0,
        collateralCount: 0,
        duration: BigInt(durationPreset),
        deadline: BigInt(deadline),
        multiLender: false,
        nonce,
        chainId: CHAIN_ID,
      })

      // Sign with wallet (in-place, no navigation)
      const signature = await signTypedData(typedData)

      // Serialize assets with string values for the API (bigint not JSON-safe)
      const apiDebtAssets = debtAssets.map(a => ({
        asset_address: a.asset_address,
        asset_type: a.asset_type,
        value: a.value.toString(),
        token_id: a.token_id.toString(),
      }))

      // Submit to API
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower: address,
          order_data: {
            borrower: address,
            debtAssets: apiDebtAssets,
            interestAssets: [],
            collateralAssets: [],
            duration: durationPreset,
            deadline: String(deadline),
            multiLender: false,
          },
          nonce: String(nonce),
          signature,
          deadline: String(deadline),
          asset_hash: hashAssets(debtAssets),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || 'Order could not be submitted. The network may be congested -- please try again.')
      }

      // Success: close modal + toast (per UI-SPEC NAV-03 success behavior)
      toast.success('Lend offer signed successfully')
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Signing failed. Check your wallet connection and try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md bg-abyss border-edge/30 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-chalk font-display text-xs uppercase tracking-wider">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Amount input */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-dust mb-1.5 block">
              Amount
            </label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`0.00 ${debtSymbol}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-sm bg-surface/30 border-edge/30"
            />
          </div>

          {/* Duration selector (per UI-SPEC NAV-03: modal contents include "duration selector") */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-dust mb-1.5 block">
              Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDurationPreset(preset.value)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    durationPreset === preset.value
                      ? 'bg-star/20 text-star border border-star/40'
                      : 'bg-surface/30 text-dust border border-edge/20 hover:border-edge/40'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fee breakdown -- per UI-SPEC: must appear above the Sign button */}
          <FeeBreakdown type="lending" />

          {/* Sign button -- gated by wallet connection */}
          <Web3ActionWrapper centered={false}>
            <Button
              onClick={handleSign}
              disabled={!amount || isPending}
              className="w-full min-h-[36px] bg-star hover:bg-star/90 text-void font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Signing...
                </>
              ) : (
                'Sign Lend Offer'
              )}
            </Button>
          </Web3ActionWrapper>
        </div>
      </DialogContent>
    </Dialog>
  )
}
