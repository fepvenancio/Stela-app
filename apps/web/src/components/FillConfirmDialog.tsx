'use client'

import type { MatchResponse, TakerIntent } from '@fepvenancio/stela-sdk'
import { buildFillSimulation } from '@/lib/fill-simulation'
import { useFillOrder } from '@/hooks/useFillOrder'
import { formatAddress } from '@/lib/address'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface FillConfirmDialogProps {
  result: MatchResponse
  intent: TakerIntent
  onSuccess: () => void
  onBack: () => void
}

/**
 * FillConfirmDialog — confirmation card with quote preview before
 * committing to a fill transaction. Shows per-order breakdown and
 * submits an atomic multicall via useFillOrder.
 */
export function FillConfirmDialog({ result, intent, onSuccess, onBack }: FillConfirmDialogProps) {
  const sim = buildFillSimulation(result, intent)
  const { fill, isPending } = useFillOrder()

  async function handleConfirm() {
    await fill(result.matches)
    onSuccess()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
          Confirm Fill
        </h3>
        <p className="text-xs text-dust">
          Review the quote below before submitting your transaction.
        </p>
      </div>

      {/* Quote preview */}
      <Card className="border-star/20 bg-star/[0.02] rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Avg Rate</span>
              <span className="text-lg font-display text-star">{sim.weightedAverageRateBps} BPS</span>
            </div>
            <div>
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Orders</span>
              <span className="text-lg font-display text-chalk">{sim.orderCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Total Fill</span>
              <span className="text-lg font-display text-chalk">{sim.totalFillBps} BPS</span>
            </div>
            <div>
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-1">Coverage</span>
              <span className="text-lg font-display text-chalk">{sim.fullyCovered ? 'Full' : 'Partial'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-edge/30" />

      {/* Per-order breakdown */}
      <div className="space-y-2">
        <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">
          Order Breakdown
        </span>
        <div className="space-y-1">
          {sim.fills.map((f, i) => (
            <div key={f.orderId} className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface/20 border border-edge/20">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ash font-mono">#{i + 1}</span>
                <span className="text-xs text-chalk font-mono">{formatAddress(f.maker)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-dust">{f.fillBps} BPS</span>
                <span className="text-ash">@{f.rateBps}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Atomic multicall warning */}
      {result.matches.length >= 3 && (
        <p className="text-[10px] text-ash bg-surface/30 border border-edge/20 rounded-xl p-3">
          This fill is atomic: all {result.matches.length} orders are submitted as a single multicall.
          If any matched order is no longer fillable, the entire transaction will revert.
        </p>
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
        <Button
          variant="gold"
          size="xl"
          className="flex-1 h-14 text-base uppercase tracking-widest"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? 'Filling...' : 'Confirm Fill'}
        </Button>
      </div>
    </div>
  )
}
