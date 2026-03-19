# Phase 4: Bot Matching - Research

**Researched:** 2026-03-19
**Domain:** Bot settlement prioritization + frontend matching preview
**Confidence:** HIGH

## Summary

Phase 4 addresses two requirements: making the bot settle matched orders by lowest interest rate first (BOT-01), and showing users which offers the bot will prioritize on the frontend (BOT-02). Both are narrowly scoped changes to existing infrastructure.

The bot Worker (`workers/bot/src/index.ts`) currently fetches matched order-offer pairs via `getMatchedOrdersFull()` which sorts by `duration ASC, created_at ASC`. BOT-01 requires changing this to sort by interest rate (interest/debt ratio) ascending. The interest rate must be computed from the `order_data` JSON's `interestAssets` and `debtAssets` arrays. Since D1/SQLite cannot compute this ratio in SQL (it requires parsing JSON arrays and summing values), the rate-sort must happen in application code after fetching.

The frontend already has `BestTradesPanel` with `BlendedRateSummary` from Phase 2. It sorts trades by score (APR for lending, rate for swaps) in descending order (best for lender first). BOT-02 requires adding a visual indicator showing which offers the bot will settle and annotating them with rank position. The `computeYieldPercent` function in `filter-utils.ts` computes interest/debt ratio -- the same function should be extracted to a shared utility so the bot and frontend use identical logic.

**Primary recommendation:** Extract rate computation to `@stela/core`, modify the bot's `getMatchedOrdersFull` query to fetch all matched orders (remove the `ORDER BY`), sort in-memory by computed rate ASC in the bot, and add rank annotations in `BestTradesPanel`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOT-01 | Bot settles offers in order of lowest interest rate first, aggregating multiple until the requested amount is filled | Bot query modification + in-memory rate sort; rate computation shared via @stela/core |
| BOT-02 | Frontend displays which offers the bot will match for a given order and the reasoning (rate ranking) | BestTradesPanel already rate-sorts; add rank badge + "Bot Priority" indicator |
</phase_requirements>

## Standard Stack

No new dependencies. All changes use existing libraries and infrastructure.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @stela/core | workspace | Shared rate computation + D1 queries | Already the shared package for all workers and frontend |
| Cloudflare Workers | - | Bot runtime | Already deployed |
| starknet.js | v9 | Bot settlement transactions | Already used by bot |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query | v5 | Frontend data fetching for order list | Already active from Phase 1 |

## Architecture Patterns

### Current Bot Settlement Flow
```
scheduled() cron (every 2 min)
  -> acquireLock
  -> expireOrders (deadline-based)
  -> expireStaleNonceOrders (nonce mismatch)
  -> purgeStaleSignatures
  -> settleOrders:
       getMatchedOrdersFull() -> JOIN orders + order_offers
         WHERE status='matched' AND oo.status='pending' AND deadline > now
         ORDER BY duration ASC, created_at ASC   <-- CURRENT (no rate logic)
         LIMIT 50
       -> build calldata per pair
       -> batch execute or individual fallback
       -> markSettled (update statuses, expire siblings, purge sigs)
  -> liquidate expired inscriptions
  -> releaseLock
```

### Target Bot Settlement Flow (BOT-01)
```
settleOrders:
  getMatchedOrdersFull() -> same JOIN
    ORDER BY created_at ASC   <-- remove duration sort, keep simple
    LIMIT 50
  -> computeRate(orderData) for each row   <-- NEW: compute interest/debt ratio
  -> sort by rate ASC (lowest interest first)  <-- NEW: in-memory sort
  -> execute in sorted order (batch or individual)
  -> markSettled (unchanged)
```

### Rate Computation (shared between bot and frontend)

The rate is `sum(interestAssets ERC20 values) / sum(debtAssets ERC20 values)`. This MUST be shared to prevent bot/frontend divergence.

```typescript
// packages/core/src/rate.ts (NEW)
export function computeInterestRate(
  debtAssets: { asset_type: string; value: string }[],
  interestAssets: { asset_type: string; value: string }[],
): number | null {
  let debtTotal = 0n
  let interestTotal = 0n
  for (const a of debtAssets) {
    if (a.asset_type === 'ERC721') continue
    debtTotal += BigInt(a.value || '0')
  }
  for (const a of interestAssets) {
    if (a.asset_type === 'ERC721') continue
    interestTotal += BigInt(a.value || '0')
  }
  if (debtTotal === 0n) return null
  return Number((interestTotal * 1_000_000n) / debtTotal) / 1_000_000
}
```

### Frontend Matching Preview (BOT-02)

The `BestTradesPanel` already sorts by APR descending. The bot sorts by rate ascending (lowest interest = best for borrower). These are the SAME sort order viewed from different perspectives:

- **Lender perspective** (current BestTradesPanel): highest APR first = most profitable for lender
- **Bot perspective** (BOT-01): lowest interest first = cheapest for borrower = settles first

For BOT-02, the panel needs to show: "The bot will settle these offers in this order" with a rank badge (1st, 2nd, 3rd...) and explain the logic. The sort is inverted from the current BestTradesPanel sort (currently highest-first, bot settles lowest-first).

Key decision: The BestTradesPanel currently sorts DESCENDING (best for lender). The bot settles ASCENDING (best for borrower). The frontend preview should show the bot's perspective -- which offers get settled first. This means either:
1. Add a separate "Bot Settlement Queue" view sorted ascending, OR
2. Add rank badges to existing rows showing bot priority (where rank 1 = lowest rate = settled first)

**Recommendation:** Add rank badges to existing BestTradesPanel rows. The panel already shows the rate column. Adding a "Bot #1", "Bot #2" etc. badge to each row communicates priority without duplicating the display. Also add a small info tooltip explaining "The bot settles offers with the lowest interest rate first."

### Project Structure Changes
```
packages/core/src/
  rate.ts                    # NEW: computeInterestRate (shared)
  index.ts                   # re-export computeInterestRate

workers/bot/src/
  index.ts                   # MODIFY: import computeInterestRate, sort matched orders

apps/web/src/
  lib/filter-utils.ts        # MODIFY: delegate to @stela/core computeInterestRate
  components/trade/
    BestTradesPanel.tsx       # MODIFY: add bot rank badges
    BotRankBadge.tsx          # NEW: "Bot #N" indicator component
```

### Anti-Patterns to Avoid

- **Duplicate rate logic:** Never compute rates differently in bot vs frontend. The `@stela/core` function is the single source of truth.
- **SQL-based rate sort:** D1/SQLite cannot efficiently compute interest/debt ratios from JSON arrays in a query. Do it in application code.
- **Changing the offer model:** The 1:1 offer-per-order model is working. BOT-01 is about prioritization ORDER, not about accepting multiple offers on one order. Do not change `acceptOffer` atomics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate computation | Separate implementations per package | `@stela/core/rate.ts` shared function | Bot/frontend divergence is the #1 risk |
| Rate display | Custom formatting | Existing `computeYieldPercent` in filter-utils (refactor to use core) | Already handles ERC721 exclusion, same-token checks |

## Common Pitfalls

### Pitfall 1: Bot/Frontend Rate Disagreement
**What goes wrong:** Bot computes rate one way, frontend computes it differently. Users see "Bot #1" on an offer but the bot actually settles a different one first.
**Why it happens:** Two independent implementations with subtle differences (e.g., ERC721 handling, zero-value assets, BigInt precision).
**How to avoid:** Single `computeInterestRate` in `@stela/core`. Both bot and frontend import from there.
**Warning signs:** Frontend shows different order than bot logs.

### Pitfall 2: Cross-Token Rate Comparison
**What goes wrong:** Comparing interest rates across orders with different debt/interest token pairs. An order with 5% ETH interest and one with 3% USDC interest are not meaningfully comparable without a price oracle.
**Why it happens:** Naive rate sort treats all assets as fungible.
**How to avoid:** The bot's rate sort should group by token pair first, then sort by rate within each group. OR, since the bot only processes matched orders (already paired), sort globally by rate and accept the cross-token limitation.
**Warning signs:** Settlement ordering seems random to users.

### Pitfall 3: Changing Settlement Order Breaks Batch
**What goes wrong:** Reordering settlements causes a batch execute to fail because StarkNet nonce expectations change.
**Why it happens:** The bot currently uses `account.execute(calls)` for batch. Call order matters for nonce sequencing in multicall.
**How to avoid:** The batch execute in the current bot already handles this correctly -- `account.execute(calls)` is a multicall that handles nonces internally. Reordering `calls` array before batch execute is safe.
**Warning signs:** Batch settlement reverts after reordering.

### Pitfall 4: Rate is Null for Some Orders
**What goes wrong:** Orders with no computable rate (e.g., ERC721-only debt, cross-token interest) return `null` from `computeInterestRate`.
**Why it happens:** Not all orders have same-denomination interest and debt.
**How to avoid:** Null-rate orders sort last (settled after all rate-computable orders). The bot already processes all matched orders; null-rate ones just go to the end.
**Warning signs:** Some matched orders are never settled because they sort after the LIMIT 50 cutoff.

## Code Examples

### Bot: Rate-Sorted Settlement
```typescript
// workers/bot/src/index.ts
import { computeInterestRate } from '@stela/core'

async function settleOrders(/* ... */): Promise<void> {
  const matched = await queries.getMatchedOrdersFull()
  if (matched.length === 0) return

  // Compute rate and sort by lowest interest first (BOT-01)
  const withRates = matched.map(row => {
    const orderData: OrderData = JSON.parse(
      typeof row.order_data === 'string' ? row.order_data as string : JSON.stringify(row.order_data)
    )
    const rate = computeInterestRate(orderData.interestAssets, orderData.debtAssets)
    return { row, orderData, rate }
  })

  // Sort: lowest rate first, null rates last
  withRates.sort((a, b) => {
    if (a.rate === null && b.rate === null) return 0
    if (a.rate === null) return 1
    if (b.rate === null) return -1
    return a.rate - b.rate
  })

  // Continue with existing settlement logic using sorted order
  // ...
}
```

### Frontend: Bot Rank Badge
```typescript
// apps/web/src/components/trade/BotRankBadge.tsx
interface BotRankBadgeProps {
  rank: number
}

export function BotRankBadge({ rank }: BotRankBadgeProps) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-nebula/15 text-nebula">
      Bot #{rank}
    </span>
  )
}
```

### Frontend: Rate-Sorted with Bot Ranks in BestTradesPanel
```typescript
// In BestTradesPanel's ranked useMemo, after computing scores:
// Sort ascending for bot perspective (lowest rate first)
// Add botRank to each RankedTrade

const ranked = useMemo((): RankedTrade[] => {
  const all = [
    ...offchainMatches.map(normalizeOffchain),
    ...onchainMatches.map(normalizeOnchain),
  ]

  for (const trade of all) {
    trade.score = mode === 'swap'
      ? computeSwapRate(trade.debtAssets, trade.collateralAssets)
      : computeYieldPercent(trade.debtAssets, trade.interestAssets)
  }

  // Sort by score ascending (lowest rate first = bot priority)
  all.sort((a, b) => {
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return a.score - b.score  // ascending = lowest first = bot settles first
  })

  return all.slice(0, MAX_ROWS)
}, [offchainMatches, onchainMatches, mode])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bot settles by duration, then creation time | Bot settles by interest rate ascending | Phase 4 | Better outcomes for borrowers; predictable settlement |
| BestTradesPanel shows highest APR first (lender view) | Shows bot settlement priority (lowest rate first) | Phase 4 | Users understand what will settle and why |

## Open Questions

1. **Sort direction for BestTradesPanel**
   - What we know: Currently sorts descending (best for lender). Bot sorts ascending (best for borrower/cheapest).
   - What's unclear: Should the display show lender perspective (highest APR first) or bot perspective (lowest rate first = settled first)?
   - Recommendation: Show bot perspective (ascending) since BOT-02 is about showing "which offers the bot will select." Add a label explaining the sort. The lender benefits from understanding priority, not from seeing the "best deal for them" first.

2. **Cross-token rate comparison**
   - What we know: Not all orders have same-denomination interest/debt tokens.
   - What's unclear: How to handle rate comparison across different token pairs without a price oracle.
   - Recommendation: Compute rate as raw ratio (interest_value/debt_value). Cross-token rates will be numerically meaningless for comparison but the bot processes all matched orders anyway -- it just determines execution ORDER. Accept this limitation and document it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOT-01 | Bot sorts matched orders by interest rate ascending | unit | `npx vitest run packages/core/src/rate.test.ts` | No -- Wave 0 |
| BOT-01 | Null rates sort last | unit | `npx vitest run packages/core/src/rate.test.ts` | No -- Wave 0 |
| BOT-02 | BestTradesPanel shows rank badges | manual-only | Visual inspection | N/A |

### Sampling Rate
- **Per task commit:** `pnpm lint && pnpm build`
- **Per wave merge:** `pnpm lint && pnpm build`
- **Phase gate:** lint + build green, visual inspection of rank badges

### Wave 0 Gaps
- [ ] `packages/core/src/rate.test.ts` -- unit tests for computeInterestRate
- [ ] Vitest config for @stela/core (no test runner configured currently)
- [ ] Framework install: `pnpm add -D vitest --filter @stela/core`

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `workers/bot/src/index.ts` -- settlement flow, query, batch logic
- Direct codebase analysis of `packages/core/src/d1.ts` -- getMatchedOrdersFull query (line 941-967)
- Direct codebase analysis of `apps/web/src/components/trade/BestTradesPanel.tsx` -- current sort logic
- Direct codebase analysis of `apps/web/src/lib/filter-utils.ts` -- computeYieldPercent (line 96-120)
- Direct codebase analysis of `apps/web/src/lib/multi-match.ts` -- selectOrders algorithm
- Direct codebase analysis of `packages/core/src/schema-orders.sql` -- order_offers schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all changes to existing code
- Architecture: HIGH -- direct codebase analysis, clear understanding of current flow
- Pitfalls: HIGH -- identified from actual code patterns (batch execute, null rates, cross-token)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external API or library changes involved)
