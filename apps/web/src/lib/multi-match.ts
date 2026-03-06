import type { MatchedOrder } from '@/hooks/useInstantSettle'
import type { OnChainMatch, MatchAsset } from '@/hooks/useMatchDetection'

/* ── Types ──────────────────────────────────────────────── */

export interface SelectedOffchainOrder {
  type: 'offchain'
  order: MatchedOrder
  bps: number
  giveAmount: bigint
  receiveAmount: bigint
}

export interface SelectedOnchainOrder {
  type: 'onchain'
  match: OnChainMatch
  bps: number
  giveAmount: bigint
  receiveAmount: bigint
}

export type SelectedOrder = SelectedOffchainOrder | SelectedOnchainOrder

export interface SelectedOrders {
  selected: SelectedOrder[]
  totalGive: bigint
  totalReceive: bigint
  coverage: number       // 0-100
  onchainCount: number
  offchainCount: number
}

/* ── Helpers ────────────────────────────────────────────── */

function sumErc20Values(assets: MatchAsset[] | Record<string, string>[] | undefined): bigint {
  if (!assets || assets.length === 0) return 0n
  return (assets as Record<string, string>[]).reduce((sum, a) => {
    if (a.asset_type === 'ERC721') return sum
    return sum + BigInt(a.value || '0')
  }, 0n)
}

function parseOffchainDebt(order: MatchedOrder): bigint {
  const d = order.order_data
  return sumErc20Values((d.debtAssets ?? d.debt_assets) as Record<string, string>[] | undefined)
}

function parseOffchainCollateral(order: MatchedOrder): bigint {
  const d = order.order_data
  return sumErc20Values((d.collateralAssets ?? d.collateral_assets) as Record<string, string>[] | undefined)
}

function isMultiLender(order: MatchedOrder): boolean {
  const d = order.order_data
  return Boolean(d.multiLender ?? d.multi_lender)
}

/* ── Selection Algorithm ────────────────────────────────── */

/**
 * Greedy order selection for aggregate settlement.
 * Prioritizes on-chain matches (no signing popup) over off-chain (1 popup each).
 *
 * @param offchainMatches - Off-chain orders from match API
 * @param onchainMatches - On-chain inscriptions from match API
 * @param userGiveAmount - Total tokens user is willing to give (their collateral = matched orders' debt)
 */
export function selectOrders(
  offchainMatches: MatchedOrder[],
  onchainMatches: OnChainMatch[],
  userGiveAmount: bigint,
): SelectedOrders {
  if (userGiveAmount <= 0n) {
    return { selected: [], totalGive: 0n, totalReceive: 0n, coverage: 0, onchainCount: 0, offchainCount: 0 }
  }

  const selected: SelectedOrder[] = []
  let totalGive = 0n
  let totalReceive = 0n

  // Phase 1: On-chain matches first (zero signing overhead)
  // On-chain inscriptions use sign_inscription — no off-chain signature needed
  const onchainCandidates = onchainMatches
    .map((m) => ({
      match: m,
      debt: sumErc20Values(m.debtAssets),
      collateral: sumErc20Values(m.collateralAssets),
    }))
    .filter((c) => c.debt > 0n)
    .sort((a, b) => (b.debt > a.debt ? 1 : b.debt < a.debt ? -1 : 0))

  for (const { match, debt, collateral } of onchainCandidates) {
    if (totalGive + debt > userGiveAmount) continue
    selected.push({
      type: 'onchain',
      match,
      bps: 10000,
      giveAmount: debt,
      receiveAmount: collateral,
    })
    totalGive += debt
    totalReceive += collateral
    if (totalGive >= userGiveAmount) break
  }

  // Phase 2: Off-chain single-lender orders (each needs 1 signing popup)
  if (totalGive < userGiveAmount) {
    const singleLender = offchainMatches
      .filter((o) => !isMultiLender(o))
      .map((o) => ({ order: o, debt: parseOffchainDebt(o), collateral: parseOffchainCollateral(o) }))
      .filter((c) => c.debt > 0n)
      .sort((a, b) => (b.debt > a.debt ? 1 : b.debt < a.debt ? -1 : 0))

    for (const { order, debt, collateral } of singleLender) {
      if (totalGive + debt > userGiveAmount) continue
      selected.push({
        type: 'offchain',
        order,
        bps: 10000,
        giveAmount: debt,
        receiveAmount: collateral,
      })
      totalGive += debt
      totalReceive += collateral
      if (totalGive >= userGiveAmount) break
    }
  }

  // Phase 3: Partial fill a multi-lender order with remaining capacity
  if (totalGive < userGiveAmount) {
    const multiLenderOrders = offchainMatches
      .filter((o) => isMultiLender(o))
      .map((o) => ({ order: o, debt: parseOffchainDebt(o), collateral: parseOffchainCollateral(o) }))
      .filter((c) => c.debt > 0n)

    const remainingBudget = userGiveAmount - totalGive
    for (const { order, debt, collateral } of multiLenderOrders) {
      const bps = Number((remainingBudget * 10000n) / debt)
      if (bps < 1) continue

      const effectiveBps = Math.min(bps, 10000)
      const giveAmount = (debt * BigInt(effectiveBps)) / 10000n
      const receiveAmount = (collateral * BigInt(effectiveBps)) / 10000n
      if (giveAmount <= 0n) continue

      selected.push({
        type: 'offchain',
        order,
        bps: effectiveBps,
        giveAmount,
        receiveAmount,
      })
      totalGive += giveAmount
      totalReceive += receiveAmount
      break
    }
  }

  const coverage = userGiveAmount > 0n
    ? Math.min(100, Number((totalGive * 100n) / userGiveAmount))
    : 0

  const onchainCount = selected.filter((s) => s.type === 'onchain').length
  const offchainCount = selected.filter((s) => s.type === 'offchain').length

  return { selected, totalGive, totalReceive, coverage, onchainCount, offchainCount }
}
