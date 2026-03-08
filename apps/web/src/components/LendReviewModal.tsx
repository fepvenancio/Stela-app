'use client'

import { useEffect, useMemo } from 'react'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign, type BatchSignItem } from '@/hooks/useBatchSign'
import { useMultiSettle } from '@/hooks/useMultiSettle'
import type { SelectedOffchainOrder } from '@/lib/multi-match'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatTokenValue } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { X, Wallet2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface LendReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LendReviewModal({ open, onOpenChange }: LendReviewModalProps) {
  const { selected, toggle, clearAll, count } = useBatchSelection()
  const { batchSign, isPending: isBatchSignPending } = useBatchSign()
  const { settleMultiple, state: multiSettleState } = useMultiSettle()
  const { balances, isLoading: balancesLoading } = useTokenBalances()

  const isPending = isBatchSignPending || multiSettleState.phase !== 'idle'

  // Auto-close when all items removed
  useEffect(() => {
    if (open && count === 0) {
      onOpenChange(false)
    }
  }, [open, count, onOpenChange])

  // Split selections by source
  const { onchainItems, offchainItems } = useMemo(() => {
    const onchain: typeof selected extends Map<string, infer V> ? V[] : never = []
    const offchain: typeof selected extends Map<string, infer V> ? V[] : never = []
    for (const [, item] of selected) {
      if (item.source === 'offchain') offchain.push(item)
      else onchain.push(item)
    }
    return { onchainItems: onchain, offchainItems: offchain }
  }, [selected])

  // Aggregate required amounts per token
  const totals = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const [, inscription] of selected) {
      for (const asset of inscription.assets.filter((a) => a.asset_role === 'debt')) {
        const addr = asset.asset_address.toLowerCase()
        const val = BigInt(asset.value || '0')
        map.set(addr, (map.get(addr) ?? 0n) + val)
      }
    }
    return map
  }, [selected])

  const hasInsufficientBalance = useMemo(() => {
    if (balancesLoading) return false // Don't block while loading
    for (const [tokenAddr, required] of totals) {
      const available = balances.get(tokenAddr) ?? 0n
      if (available < required) return true
    }
    return false
  }, [totals, balances, balancesLoading])

  const handleConfirm = async () => {
    // Check balances
    for (const [tokenAddr, required] of totals) {
      const available = balances.get(tokenAddr) ?? 0n
      if (available < required) {
        toast.error('Insufficient balance', {
          description: 'You need more tokens to fund all selected items.',
        })
        return
      }
    }

    // Handle on-chain inscriptions via batchSign
    if (onchainItems.length > 0) {
      const items: BatchSignItem[] = onchainItems.map((item) => ({
        inscriptionId: item.id,
        bps: 10000,
        debtAssets: item.assets
          .filter((a) => a.asset_role === 'debt')
          .map((a) => ({ address: a.asset_address, value: a.value ?? '0' })),
      }))
      await batchSign(items)
    }

    // Handle off-chain orders via settleMultiple
    if (offchainItems.length > 0) {
      const offchainOrders: SelectedOffchainOrder[] = offchainItems
        .filter((item) => item.orderData)
        .map((item) => {
          // Compute give/receive from debt assets (lender gives debt tokens)
          const debtTotal = item.assets
            .filter((a) => a.asset_role === 'debt')
            .reduce((sum, a) => sum + BigInt(a.value || '0'), 0n)
          return {
            type: 'offchain' as const,
            order: {
              id: item.id,
              borrower: item.orderData!.borrower,
              borrower_signature: item.orderData!.borrower_signature,
              nonce: item.orderData!.nonce,
              deadline: Number(item.orderData!.deadline),
              created_at: Number(item.orderData!.created_at),
              order_data: item.orderData!.order_data,
            },
            bps: 10000,
            giveAmount: debtTotal,
            receiveAmount: debtTotal,
          }
        })

      if (offchainOrders.length > 0) {
        await settleMultiple(offchainOrders)
      }
    }

    clearAll()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-void border-edge/50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
            Review & Sign
          </DialogTitle>
          <DialogDescription className="text-dust text-xs">
            {count} item{count !== 1 ? 's' : ''} selected
            {onchainItems.length > 0 && offchainItems.length > 0
              ? ` (${onchainItems.length} on-chain, ${offchainItems.length} off-chain)`
              : onchainItems.length > 0 ? ' (on-chain)' : ' (off-chain)'
            }. Review the details below.
          </DialogDescription>
        </DialogHeader>

        {/* Selected inscriptions list */}
        <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
          {Array.from(selected.entries()).map(([id, item]) => (
            <div key={id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface/20 border border-edge/30 group">
              <div className="flex flex-col gap-1 min-w-0">
                <Link
                  href={`/stela/${id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[10px] text-ash tracking-wider uppercase hover:text-star transition-colors"
                >
                  #{id.slice(2, 8)}
                </Link>
                <div className="flex flex-wrap gap-2">
                  {item.assets.filter(a => a.asset_role === 'debt').map((a, i) => {
                    const token = findTokenByAddress(a.asset_address)
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <TokenAvatarByAddress address={a.asset_address} size={12} />
                        <span className="text-[10px] text-chalk font-medium">
                          {formatTokenValue(a.value, token?.decimals ?? 18)} {token?.symbol}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggle(item)}
                disabled={isPending}
                className="h-7 w-7 p-0 text-ash hover:text-nova hover:bg-nova/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label={`Remove inscription ${id.slice(2, 8)} from selection`}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        <Separator className="bg-edge/30" />

        {/* Total debt to provide */}
        <div className="space-y-2">
          <h4 className="text-[10px] text-dust uppercase tracking-widest font-semibold">Total Debt to Provide</h4>
          <div className="grid grid-cols-2 gap-2">
            {Array.from(totals.entries()).map(([addr, total]) => {
              const token = findTokenByAddress(addr)
              const available = balances.get(addr) ?? 0n
              const hasEnough = available >= total
              return (
                <div key={addr} className={`p-3 rounded-2xl border ${balancesLoading || hasEnough ? 'bg-surface/20 border-edge/30' : 'bg-nova/5 border-nova/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <TokenAvatarByAddress address={addr} size={16} />
                    <span className="text-xs font-bold text-chalk">{token?.symbol}</span>
                  </div>
                  <div className="text-sm font-display text-star">
                    {formatTokenValue(total.toString(), token?.decimals ?? 18)}
                  </div>
                  {balancesLoading ? (
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-dust">
                      <Wallet2 className="w-3 h-3 animate-pulse" />
                      <span>Checking balance...</span>
                    </div>
                  ) : !hasEnough && (
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-nova">
                      <Wallet2 className="w-3 h-3" />
                      <span>Insufficient: {formatTokenValue(available.toString(), token?.decimals ?? 18)} available</span>
                    </div>
                  )}
                </div>
              )
            })}
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
            onClick={handleConfirm}
            disabled={isPending || hasInsufficientBalance}
            className="px-6 rounded-xl font-bold shadow-lg shadow-star/20"
          >
            {isPending ? 'Processing...' : 'Confirm & Sign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
