'use client'

import type { MatchResponse, TakerIntent } from '@fepvenancio/stela-sdk'
import { buildFillSimulation } from '@/lib/fill-simulation'
import { formatAddress } from '@/lib/address'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface MatchResultListProps {
  result: MatchResponse
  intent: TakerIntent
  onFill: () => void
  onMake: () => void
}

/**
 * MatchResultList — displays ranked match results with fill simulation summary.
 */
export function MatchResultList({ result, intent, onFill, onMake }: MatchResultListProps) {
  const sim = buildFillSimulation(result, intent)

  if (result.matches.length === 0) {
    return (
      <div className="space-y-6 text-center">
        <div className="rounded-2xl border border-edge/30 bg-surface/20 p-8 space-y-3">
          <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
            No matching orders found
          </h3>
          <p className="text-xs text-dust">
            There are no orders matching your intent. Become a maker to create liquidity.
          </p>
        </div>
        <Button
          variant="gold"
          size="xl"
          className="w-full h-14 text-base uppercase tracking-widest"
          onClick={onMake}
        >
          Create an Order
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-star/20 bg-star/[0.02] rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-1">
            <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Fill Simulation</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
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
              {sim.fullyCovered ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Fully Covered</Badge>
              ) : (
                <Badge className="bg-nova/20 text-nova border-nova/30 text-xs">Partial</Badge>
              )}
            </div>
          </div>
          {!sim.fullyCovered && (
            <p className="text-xs text-dust mt-4">
              Your intent is only partially covered.{' '}
              <button onClick={onMake} className="text-star hover:text-star-bright underline transition-colors">
                Become a maker
              </button>{' '}
              to fill the gap.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results list */}
      <div className="space-y-3">
        <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">
          Matched Orders ({result.matches.length})
        </span>
        {result.matches.map((m, i) => (
          <Card key={m.order.id} className="rounded-2xl border-edge/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ash font-mono">#{i + 1}</span>
                  <span className="text-xs text-chalk font-mono">{formatAddress(m.order.maker)}</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-star/30 text-star">
                  Score: {m.score.toFixed(2)}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-0.5">Rate</span>
                  <span className="text-sm font-mono text-chalk">{m.order.bps} BPS</span>
                </div>
                <div>
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-0.5">Fill</span>
                  <span className="text-sm font-mono text-chalk">{m.fill_bps} / {m.available_bps}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-0.5">Deadline</span>
                  <span className="text-sm font-mono text-chalk">
                    {new Date(m.order.deadline * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action */}
      <Button
        variant="gold"
        size="xl"
        className="w-full h-14 text-base uppercase tracking-widest"
        onClick={onFill}
      >
        Fill Orders
      </Button>
    </div>
  )
}
