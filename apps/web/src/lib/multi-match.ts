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
 * Optimal subset-sum order selection for aggregate settlement.
 *
 * Uses dynamic programming (meet-in-the-middle for >20 items) to find the
 * combination of orders that maximizes coverage of the user's budget without
 * exceeding it. Prioritizes on-chain matches (no signing overhead) by giving
 * them a slight tie-breaking advantage.
 *
 * Falls back to greedy for very large candidate sets (>40) where DP is too slow.
 *
 * @param offchainMatches - Off-chain orders from match API
 * @param onchainMatches - On-chain inscriptions from match API
 * @param userGiveAmount - Total tokens user is willing to give
 */
export function selectOrders(
  offchainMatches: MatchedOrder[],
  onchainMatches: OnChainMatch[],
  userGiveAmount: bigint,
): SelectedOrders {
  if (userGiveAmount <= 0n) {
    return { selected: [], totalGive: 0n, totalReceive: 0n, coverage: 0, onchainCount: 0, offchainCount: 0 }
  }

  // Build unified candidate list with priority (on-chain first, then single-lender, then multi-lender)
  interface Candidate {
    debt: bigint
    collateral: bigint
    priority: number // 0 = on-chain, 1 = off-chain single, 2 = off-chain multi
    onchain?: OnChainMatch
    offchain?: MatchedOrder
    multiLender: boolean
  }

  const candidates: Candidate[] = []

  for (const m of onchainMatches) {
    const debt = sumErc20Values(m.debtAssets)
    if (debt <= 0n) continue
    candidates.push({ debt, collateral: sumErc20Values(m.collateralAssets), priority: 0, onchain: m, multiLender: false })
  }

  for (const o of offchainMatches) {
    const debt = parseOffchainDebt(o)
    if (debt <= 0n) continue
    const ml = isMultiLender(o)
    candidates.push({ debt, collateral: parseOffchainCollateral(o), priority: ml ? 2 : 1, offchain: o, multiLender: ml })
  }

  // Separate full-fill candidates (single-lender + on-chain) from partial-fill (multi-lender)
  const fullCandidates = candidates.filter(c => !c.multiLender)
  const partialCandidates = candidates.filter(c => c.multiLender)

  // Sort by priority (on-chain first), then by debt descending for tie-breaking
  fullCandidates.sort((a, b) => a.priority - b.priority || (b.debt > a.debt ? 1 : b.debt < a.debt ? -1 : 0))

  // Find optimal subset of full-fill candidates
  // ≤25: exact DP/meet-in-middle, >25: greedy + local search refinement
  const debts = fullCandidates.map(c => c.debt)
  const bestIndices = fullCandidates.length <= 25
    ? dpSubsetSum(debts, userGiveAmount)
    : greedyWithRefinement(debts, userGiveAmount)

  const selected: SelectedOrder[] = []
  let totalGive = 0n
  let totalReceive = 0n

  for (const idx of bestIndices) {
    const c = fullCandidates[idx]
    if (c.onchain) {
      selected.push({ type: 'onchain', match: c.onchain, bps: 10000, giveAmount: c.debt, receiveAmount: c.collateral })
    } else if (c.offchain) {
      selected.push({ type: 'offchain', order: c.offchain, bps: 10000, giveAmount: c.debt, receiveAmount: c.collateral })
    }
    totalGive += c.debt
    totalReceive += c.collateral
  }

  // Phase 3: Partial fill a multi-lender order with remaining capacity
  if (totalGive < userGiveAmount && partialCandidates.length > 0) {
    const remainingBudget = userGiveAmount - totalGive
    // Pick the multi-lender order that best fits remaining budget
    const sorted = [...partialCandidates].sort((a, b) => {
      // Prefer orders closest to remaining budget (minimize waste)
      const aFit = a.debt <= remainingBudget ? remainingBudget - a.debt : a.debt - remainingBudget
      const bFit = b.debt <= remainingBudget ? remainingBudget - b.debt : b.debt - remainingBudget
      return aFit < bFit ? -1 : aFit > bFit ? 1 : 0
    })

    for (const c of sorted) {
      const bps = Number((remainingBudget * 10000n) / c.debt)
      if (bps < 1) continue

      const effectiveBps = Math.min(bps, 10000)
      const giveAmount = (c.debt * BigInt(effectiveBps) + 9999n) / 10000n
      const receiveAmount = (c.collateral * BigInt(effectiveBps)) / 10000n
      if (giveAmount <= 0n) continue

      selected.push({ type: 'offchain', order: c.offchain!, bps: effectiveBps, giveAmount, receiveAmount })
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

/* ── Subset-Sum DP (exact, O(n * W) but W capped) ──────── */

/**
 * Find the subset of `values` whose sum is closest to (but ≤) `budget`.
 * Uses bitmask DP for up to 25 items. Returns indices of selected items.
 */
function dpSubsetSum(values: bigint[], budget: bigint): number[] {
  const n = values.length
  if (n === 0) return []

  // Meet-in-the-middle for n > 15 (2^15 = 32K per half)
  if (n > 15) return meetInTheMiddle(values, budget)

  // Direct enumeration for n ≤ 15 (2^15 = 32K states)
  let bestSum = 0n
  let bestMask = 0

  const limit = 1 << n
  for (let mask = 1; mask < limit; mask++) {
    let sum = 0n
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += values[i]
      if (sum > budget) break
    }
    if (sum <= budget && sum > bestSum) {
      bestSum = sum
      bestMask = mask
      if (sum === budget) break
    }
  }

  const result: number[] = []
  for (let i = 0; i < n; i++) {
    if (bestMask & (1 << i)) result.push(i)
  }
  return result
}

/** Meet-in-the-middle for 16-25 items: split, enumerate halves, binary search */
function meetInTheMiddle(values: bigint[], budget: bigint): number[] {
  const n = values.length
  const mid = Math.floor(n / 2)

  // Enumerate left half
  const leftSize = mid
  const leftCount = 1 << leftSize
  const leftSums: { sum: bigint; mask: number }[] = []
  for (let mask = 0; mask < leftCount; mask++) {
    let sum = 0n
    for (let i = 0; i < leftSize; i++) {
      if (mask & (1 << i)) sum += values[i]
    }
    if (sum <= budget) leftSums.push({ sum, mask })
  }
  leftSums.sort((a, b) => (a.sum < b.sum ? -1 : a.sum > b.sum ? 1 : 0))

  // Enumerate right half and binary search for best left complement
  const rightSize = n - mid
  const rightCount = 1 << rightSize
  let bestSum = 0n
  let bestLeftMask = 0
  let bestRightMask = 0

  for (let rmask = 0; rmask < rightCount; rmask++) {
    let rsum = 0n
    for (let i = 0; i < rightSize; i++) {
      if (rmask & (1 << i)) rsum += values[mid + i]
    }
    if (rsum > budget) continue

    const remaining = budget - rsum
    // Binary search for largest leftSum <= remaining
    let lo = 0, hi = leftSums.length - 1, bestIdx = 0
    while (lo <= hi) {
      const m = (lo + hi) >> 1
      if (leftSums[m].sum <= remaining) { bestIdx = m; lo = m + 1 }
      else hi = m - 1
    }

    const total = leftSums[bestIdx].sum + rsum
    if (total > bestSum) {
      bestSum = total
      bestLeftMask = leftSums[bestIdx].mask
      bestRightMask = rmask
      if (total === budget) break
    }
  }

  const result: number[] = []
  for (let i = 0; i < leftSize; i++) {
    if (bestLeftMask & (1 << i)) result.push(i)
  }
  for (let i = 0; i < rightSize; i++) {
    if (bestRightMask & (1 << i)) result.push(mid + i)
  }
  return result
}

/* ── Greedy + Local Search Refinement (>25 items) ───────── */

/**
 * Two-phase algorithm for large candidate sets:
 *
 * Phase 1 — Greedy: Sort descending, pack greedily. O(n log n).
 * Phase 2 — Swap refinement: For each gap (budget - sum), try swapping a
 *   selected item for an unselected one that closes the gap. Uses a sorted
 *   unselected array with binary search for O(k * log n) per pass.
 * Phase 3 — Add pass: Try adding small unselected items that fit the remaining gap.
 *
 * Guarantees: At least as good as greedy, typically much better.
 * Complexity: O(n log n) total — safe for 1M+ items.
 */
function greedyWithRefinement(values: bigint[], budget: bigint): number[] {
  const n = values.length
  if (n === 0) return []

  // Phase 1: Greedy (largest-first)
  const sortedIndices = values.map((_, i) => i)
    .sort((a, b) => (values[b] > values[a] ? 1 : values[b] < values[a] ? -1 : 0))

  const inSet = new Uint8Array(n) // 0/1 membership for O(1) lookup
  const selected: number[] = []
  let sum = 0n

  for (const i of sortedIndices) {
    if (sum + values[i] <= budget) {
      selected.push(i)
      inSet[i] = 1
      sum += values[i]
      if (sum === budget) return selected
    }
  }

  // Phase 2: Swap refinement
  // For each selected item, check if swapping it for an unselected item gets closer to budget
  const gap = budget - sum
  if (gap > 0n) {
    // Build sorted array of unselected items for binary search
    const unselected = sortedIndices.filter(i => !inSet[i])
    // unselected is already sorted by value descending

    let improved = true
    let passes = 0
    const MAX_PASSES = 3 // Limit refinement passes

    while (improved && passes < MAX_PASSES) {
      improved = false
      passes++

      for (let si = 0; si < selected.length; si++) {
        const selIdx = selected[si]
        const selVal = values[selIdx]
        const currentSum = sum

        // We want to find an unselected item with value in (selVal, selVal + gap]
        // That would increase sum by (newVal - selVal) without exceeding budget
        const target = selVal + (budget - currentSum)

        // Binary search for the largest unselected value ≤ target that is > selVal
        let bestSwap = -1
        let bestSwapVal = 0n
        let lo = 0, hi = unselected.length - 1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          const uVal = values[unselected[mid]]
          if (uVal <= target && uVal > selVal) {
            bestSwap = mid
            bestSwapVal = uVal
            hi = mid - 1 // look for even larger
          } else if (uVal > target) {
            lo = mid + 1
          } else {
            hi = mid - 1
          }
        }

        if (bestSwap !== -1) {
          const swapIdx = unselected[bestSwap]
          // Perform swap
          inSet[selIdx] = 0
          inSet[swapIdx] = 1
          selected[si] = swapIdx
          sum = currentSum - selVal + bestSwapVal
          // Update unselected: remove swapIdx, add selIdx
          unselected[bestSwap] = selIdx
          // Re-sort is expensive; just mark and continue
          improved = true
          if (sum === budget) return selected
        }
      }
    }
  }

  // Phase 3: Add pass — try to fit remaining small items into the gap
  const finalGap = budget - sum
  if (finalGap > 0n) {
    // Scan unselected from smallest to largest
    for (let i = sortedIndices.length - 1; i >= 0; i--) {
      const idx = sortedIndices[i]
      if (inSet[idx]) continue
      if (values[idx] <= finalGap) {
        // Check against actual remaining budget
        if (sum + values[idx] <= budget) {
          selected.push(idx)
          inSet[idx] = 1
          sum += values[idx]
          if (sum === budget) break
        }
      }
    }
  }

  return selected
}
