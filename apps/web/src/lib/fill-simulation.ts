import type { MatchResponse, TakerIntent } from '@fepvenancio/stela-sdk'

export interface FillSimulation {
  fills: {
    orderId: string
    maker: string
    rateBps: number
    fillBps: number
    availableBps: number
    deadline: number
  }[]
  totalFillBps: number
  fullyCovered: boolean
  weightedAverageRateBps: number
  orderCount: number
}

/**
 * Pure computation: build a fill simulation from a MatchResponse.
 * Produces weighted average rate and per-order fill breakdown.
 */
export function buildFillSimulation(
  result: MatchResponse,
  _intent: TakerIntent,
): FillSimulation {
  const fills = result.matches.map((m) => ({
    orderId: m.order.id,
    maker: m.order.maker,
    rateBps: Number(m.order.bps),
    fillBps: m.fill_bps,
    availableBps: m.available_bps,
    deadline: m.order.deadline,
  }))

  const totalFillBps = fills.reduce((acc, f) => acc + f.fillBps, 0)
  const weightedRate =
    totalFillBps > 0
      ? fills.reduce((acc, f) => acc + f.rateBps * f.fillBps, 0) / totalFillBps
      : 0

  return {
    fills,
    totalFillBps: result.total_available_bps,
    fullyCovered: result.fully_covered,
    weightedAverageRateBps: Math.round(weightedRate),
    orderCount: result.matches.length,
  }
}
