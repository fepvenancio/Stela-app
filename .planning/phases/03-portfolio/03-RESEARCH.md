# Phase 3: Portfolio - Research

**Researched:** 2026-03-19
**Domain:** Portfolio page -- position display, summary stats, inline actions
**Confidence:** HIGH

## Summary

The portfolio page is far more complete than the initial research summary suggested. The page (`apps/web/src/app/portfolio/page.tsx`) is a fully built 407-line component with three tabs (Active, Pending, History), search filtering, section headings (Lending/Borrowing/Redeemable/Past Orders), empty states, loading skeletons, and smart default tab selection. The `usePortfolio` hook is fully migrated to TanStack Query (6 queries, 30s polling). The page renders `InscriptionListRow` and `OrderListRow` components for each position, which link to `/stela/{id}` detail pages.

What is **missing** are the three requirements: (1) PORT-01 is largely satisfied -- the page displays positions with status, but the `InscriptionListRow` does not receive `signedAt` data for countdown timers on the portfolio page, even though it supports it via props. (2) PORT-02 -- the `SummaryBar` component exists with `totalLent`, `collateralLocked`, `redeemableCount`, and `orderCount` metrics, but it is never rendered on the portfolio page. The computation of `PortfolioSummary` from `PortfolioData` does not exist yet. (3) PORT-03 -- the `InscriptionListRow` and `OrderListRow` components both support `onAction` and `actionPending` props for inline action buttons, but the portfolio page never passes these props. The action logic (repay, redeem, cancel, liquidate) already exists in `InscriptionActions.tsx` and `hooks/transactions.ts`.

**Primary recommendation:** This is a wiring and computation phase. All components, hooks, and action logic exist. The work is: (1) compute `PortfolioSummary` from `PortfolioData` and render `SummaryBar`, (2) pass `signedAt` to `InscriptionListRow` for countdown timers, (3) wire inline action callbacks into the list rows using the existing transaction hooks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-01 | Portfolio page displays user's active lending and borrowing positions with current status | Page already renders positions with status badges. Gap: `signedAt` not passed to `InscriptionListRow` so countdown timers are absent on portfolio. Fix by passing `inscription.signed_at` prop. |
| PORT-02 | Portfolio shows summary bar with total value lent, borrowed, and overall position health | `SummaryBar` component exists but is never rendered. Need to: (1) write a `computePortfolioSummary()` function that aggregates token amounts from `PortfolioData`, (2) render `<SummaryBar>` at top of portfolio page. |
| PORT-03 | Each position card shows inline action buttons (repay, redeem, claim) relevant to its state | `InscriptionListRow` and `OrderListRow` both accept `onAction`/`actionPending` props but portfolio never passes them. Need to: determine available action per position status, wire transaction hooks (`useRepayInscription`, `useRedeemShares`, `useCancelInscription`, `useLiquidateInscription`) into callbacks. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.91.3 | Server state for portfolio data | Already active -- usePortfolio uses 6 useQuery calls |
| @starknet-react/core | v3 | Wallet context, useSendTransaction | Already used for all on-chain actions |
| starknet.js | v6 | RPC calls, transaction building | Already used in transactions.ts |
| @fepvenancio/stela-sdk | latest | InscriptionClient, toU256, findTokenByAddress | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | installed | Toast notifications for action feedback | Already used in InscriptionActions/OrderActions |
| lucide-react | installed | Loader2 spinner for pending states | Already used in list row components |

No new dependencies needed for this phase.

## Architecture Patterns

### Pattern 1: Summary Computation from PortfolioData

**What:** Pure function that aggregates `PortfolioData` into `PortfolioSummary` for `SummaryBar`.

**When to use:** Whenever the portfolio page renders.

**Example:**
```typescript
// In usePortfolio.ts or a separate utility
function computePortfolioSummary(data: PortfolioData): PortfolioSummary {
  const lentMap = new Map<string, bigint>() // token address -> total

  for (const ins of data.lending) {
    for (const asset of (ins.assets ?? []).filter(a => a.asset_role === 'debt')) {
      const token = findTokenByAddress(asset.asset_address)
      const current = lentMap.get(asset.asset_address) ?? 0n
      lentMap.set(asset.asset_address, current + BigInt(asset.value ?? '0'))
    }
  }

  // Similar for collateral from borrowing positions
  // Convert maps to TokenAmount[]

  return {
    totalLent: [...lentMap entries as TokenAmount[]],
    collateralLocked: [...],
    redeemableCount: data.redeemable.length,
    orderCount: data.borrowingOrders.length + data.lendingOrders.length,
  }
}
```

### Pattern 2: Inline Action Dispatch per Status

**What:** Determine available action for a position based on its status and user role, then pass the action callback to the list row component.

**When to use:** Each position row in the portfolio.

**Key status-to-action mapping (from InscriptionActions.tsx):**

| Status | User Role | Action | Hook |
|--------|-----------|--------|------|
| open/partial | Owner (creator) | Cancel | `useCancelInscription` |
| filled | Borrower | Repay | `useRepayInscription` |
| repaid/liquidated | Lender (shares > 0) | Redeem | `useRedeemShares` |
| expired (was signed) | Anyone | Liquidate | `useLiquidateInscription` |
| grace_period | Borrower | Repay | `useRepayInscription` |
| overdue | Anyone | Liquidate | `useLiquidateInscription` |
| pending (order) | Borrower | Cancel | Off-chain cancel via API |

**Critical design consideration:** The transaction hooks (`useRepayInscription`, `useRedeemShares`, etc.) are instantiated per inscription ID. In the portfolio list, you cannot call `useRepayInscription(id)` conditionally for each row. Two approaches:

1. **Lift to wrapper component:** Create a `PortfolioActionRow` wrapper that takes an inscription, determines the action, and instantiates the correct hook inside.
2. **Generic action callback:** Create a single `usePortfolioAction()` hook that delegates to the appropriate transaction function based on status, using `useSendTransaction` directly.

**Recommended approach:** Option 1 -- wrap each `InscriptionListRow` in a thin component that conditionally instantiates the relevant transaction hook. This preserves the existing hook contracts and avoids building new infrastructure. Example:

```typescript
function PortfolioInscriptionRow({ inscription, userAddress }: Props) {
  const action = usePortfolioRowAction(inscription, userAddress)

  return (
    <InscriptionListRow
      {...inscriptionProps}
      signedAt={inscription.signed_at ?? undefined}
      onAction={action?.execute}
      actionPending={action?.isPending}
    />
  )
}
```

### Pattern 3: SummaryBar Placement

**What:** Render `SummaryBar` above the tabs, below the search bar.

**When to use:** Always when user has positions (totalPositions > 0).

The `SummaryBar` component renders a 4-column grid with MetricCard children. It should render between the search input and the tabs, so it is always visible regardless of active tab.

### Anti-Patterns to Avoid

- **Calling transaction hooks conditionally:** React hooks cannot be called conditionally. Each position row that needs an action button must wrap the hook call in a component that always renders.
- **Creating new action components from scratch:** The `InscriptionActions` component on the detail page has full action logic (repay, redeem, cancel, liquidate) with confirmation dialogs and progress modals. For inline portfolio actions, reuse the hook logic but simplify the UI to a single button (no confirmation dialog needed -- the row already has a confirm/cancel mini-dialog pattern built into `InscriptionListRow`).
- **Fetching extra data for the summary:** All data needed for `PortfolioSummary` is already in `PortfolioData` (inscriptions have assets with `asset_role` and `value`). No additional API calls needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction execution | Custom fetch + RPC calls | `useSignInscription`, `useRepayInscription`, `useRedeemShares`, `useCancelInscription`, `useLiquidateInscription` from `hooks/transactions.ts` | Already handles approvals, multicall, error handling, sync |
| Status-to-action mapping | Inline conditionals in portfolio | Status mapping function referencing `InscriptionActions.tsx` logic | 10+ status states, each with different action eligibility |
| Token formatting | Manual BigInt -> string | `formatTokenValue(value, decimals)` from `@/lib/format` | Already handles all decimal cases |
| Token metadata | Manual address -> name lookup | `findTokenByAddress(address)` from `@fepvenancio/stela-sdk` | Token registry already in SDK |

## Common Pitfalls

### Pitfall 1: Hook Rules Violation with Dynamic Actions
**What goes wrong:** Trying to conditionally call `useRepayInscription(id)` based on inscription status inside a map loop.
**Why it happens:** React hooks must be called unconditionally at the top level of a component.
**How to avoid:** Wrap each row in its own component that handles the hook instantiation.
**Warning signs:** "Rendered more hooks than during the previous render" error.

### Pitfall 2: Missing signedAt Prop
**What goes wrong:** Countdown timers ("3d 12h remaining") don't appear on portfolio position rows.
**Why it happens:** The portfolio page currently doesn't pass `signedAt` to `InscriptionListRow`, even though the data is available in `EnrichedInscription` (as `signed_at` from the API).
**How to avoid:** Pass `signedAt={inscription.signed_at ?? undefined}` explicitly.

### Pitfall 3: BigInt Aggregation Overflow
**What goes wrong:** Summary bar shows wrong totals.
**Why it happens:** Token values are stored as strings in the API response. Must convert to BigInt for aggregation, then back to string for display.
**How to avoid:** Use `BigInt(asset.value ?? '0')` consistently. The `formatTokenValue` function already handles BigInt string input.

### Pitfall 4: Summary Showing Zero for Unlent Positions
**What goes wrong:** "Total Lent" shows 0 even though user has active lending positions.
**Why it happens:** Confusing `lending` (positions where user IS lender) with "total debt in open inscriptions."
**How to avoid:** `totalLent` should aggregate debt assets from `lending` array (positions where user is lender and inscription is filled/active). `collateralLocked` should aggregate collateral assets from `borrowing` array (positions where user is borrower and inscription is filled).

### Pitfall 5: Action Button Label Mismatch
**What goes wrong:** InscriptionListRow's built-in action button says "Lend" or "Swap" -- but portfolio actions should say "Repay", "Claim", or "Cancel".
**Why it happens:** The `InscriptionListRow` component has hardcoded action labels (`isSwap ? 'Swap' : 'Lend'`).
**How to avoid:** Add an `actionLabel` prop to `InscriptionListRow` that overrides the default button text when provided.

## Code Examples

### Computing PortfolioSummary

```typescript
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { PortfolioSummary, TokenAmount } from '@/components/portfolio/SummaryBar'
import type { PortfolioData, EnrichedInscription } from '@/hooks/usePortfolio'

const ACTIVE_STATUSES = new Set(['filled', 'grace_period'])

function aggregateAssets(inscriptions: EnrichedInscription[], role: string, statusFilter?: Set<string>): TokenAmount[] {
  const map = new Map<string, bigint>()

  for (const ins of inscriptions) {
    if (statusFilter && !statusFilter.has(ins.computedStatus)) continue
    for (const asset of (ins.assets ?? []).filter(a => a.asset_role === role)) {
      const current = map.get(asset.asset_address) ?? 0n
      map.set(asset.asset_address, current + BigInt(asset.value ?? '0'))
    }
  }

  return [...map.entries()].map(([address, total]) => {
    const token = findTokenByAddress(address)
    return {
      address,
      symbol: token?.symbol ?? address.slice(0, 8),
      decimals: token?.decimals ?? 18,
      total,
    }
  })
}

export function computePortfolioSummary(data: PortfolioData): PortfolioSummary {
  return {
    totalLent: aggregateAssets(data.lending, 'debt', ACTIVE_STATUSES),
    collateralLocked: aggregateAssets(data.borrowing, 'collateral', ACTIVE_STATUSES),
    redeemableCount: data.redeemable.length,
    orderCount: data.borrowingOrders.length + data.lendingOrders.length,
  }
}
```

### Action Label Prop Extension

```typescript
// In InscriptionListRow.tsx -- add prop
interface InscriptionListRowProps {
  // ... existing props
  actionLabel?: string  // Override default "Lend"/"Swap" label
}

// In the render, replace hardcoded label:
// Before: {actionPending ? <Loader2 .../> : isSwap ? 'Swap' : 'Lend'}
// After:  {actionPending ? <Loader2 .../> : actionLabel ?? (isSwap ? 'Swap' : 'Lend')}
```

### Portfolio Action Row Wrapper

```typescript
function PortfolioInscriptionRow({ ins, address }: { ins: EnrichedInscription; address: string }) {
  const isBorrower = ins.borrower ? normalizeAddress(ins.borrower) === address : false
  const isCreator = normalizeAddress(ins.creator) === address

  // Determine which action is available
  const status = ins.computedStatus
  const needsRepay = (status === 'filled' || status === 'grace_period') && isBorrower
  const needsRedeem = (status === 'repaid' || status === 'liquidated') && ins.pendingShares
  const needsCancel = status === 'open' && isCreator

  // Conditionally use the appropriate hook
  // (each hook is always called -- just not all used)
  const { repay, isPending: repayPending } = useRepayInscription(ins.id)
  const { redeem, isPending: redeemPending } = useRedeemShares(ins.id)
  const { cancel, isPending: cancelPending } = useCancelInscription(ins.id)

  let onAction: (() => void) | undefined
  let actionPending = false
  let actionLabel: string | undefined

  if (needsRepay) {
    const debtAssets = (ins.assets ?? []).filter(a => a.asset_role === 'debt').map(a => ({ address: a.asset_address, value: a.value }))
    const interestAssets = (ins.assets ?? []).filter(a => a.asset_role === 'interest').map(a => ({ address: a.asset_address, value: a.value }))
    onAction = () => repay(debtAssets, interestAssets)
    actionPending = repayPending
    actionLabel = 'Repay'
  } else if (needsRedeem) {
    onAction = () => redeem(BigInt(ins.pendingShares!))
    actionPending = redeemPending
    actionLabel = 'Claim'
  } else if (needsCancel) {
    onAction = () => cancel()
    actionPending = cancelPending
    actionLabel = 'Cancel'
  }

  return (
    <InscriptionListRow
      id={ins.id}
      status={ins.computedStatus}
      creator={ins.creator}
      multiLender={ins.multi_lender}
      duration={ins.duration}
      assets={ins.assets ?? []}
      pendingShares={ins.pendingShares}
      signedAt={ins.signed_at ?? undefined}
      onAction={onAction}
      actionPending={actionPending}
      actionLabel={actionLabel}
    />
  )
}
```

**Important:** This instantiates 3 hooks per row regardless of which one is used. For large portfolios this could be wasteful. An alternative is to use a single generic hook that takes a callback, but for the current scale (INSCRIPTIONS_LIMIT=200) this is fine.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom useFetchApi in usePortfolio | TanStack Query (6 useQuery calls) | Phase 1 (this project) | Portfolio data already uses modern fetching |
| PositionCard grid layout | InscriptionListRow table layout | Current codebase | Portfolio uses list rows, not cards |
| stela:sync event for refresh | queryClient.invalidateQueries() | Phase 1 | Actions auto-refresh portfolio data |

**Key insight:** The original research said "PositionCard and SummaryBar exist but aren't wired up." This is half-right. `SummaryBar` genuinely is not rendered. But `PositionCard` has been superseded by `InscriptionListRow` -- the portfolio page already uses list rows, not card grids. The `PositionCard` component exists but is unused and not needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | Portfolio displays positions with status | manual-only | N/A -- visual rendering, requires wallet | N/A |
| PORT-02 | Summary bar shows aggregated totals | unit (for computePortfolioSummary) | Could add vitest test | No |
| PORT-03 | Inline action buttons per status | manual-only | N/A -- requires wallet + on-chain state | N/A |

### Sampling Rate
- No test framework exists. Verification is manual via browser inspection.

### Wave 0 Gaps
- No test framework installed (no jest, vitest, or playwright config)
- The `computePortfolioSummary` function is the only easily unit-testable piece
- Manual verification: connect wallet on sepolia, check portfolio page renders positions with actions

## Open Questions

1. **Should PositionCard be used or removed?**
   - What we know: Portfolio page uses `InscriptionListRow`/`OrderListRow`, not `PositionCard`. `PositionCard` is orphaned.
   - Recommendation: Ignore `PositionCard` for this phase. It can be removed in a cleanup pass. The list-row approach is already working and consistent with the rest of the app.

2. **Should the SummaryBar show "Total Borrowed" instead of "Collateral Locked"?**
   - What we know: The requirement says "total value lent, borrowed, and overall position health." The existing `SummaryBar` component shows `totalLent`, `collateralLocked`, `redeemableCount`, `orderCount` -- no "total borrowed" or "position health."
   - Recommendation: Adapt the SummaryBar to match requirements. Replace `collateralLocked` with `totalBorrowed` (sum of debt assets from borrowing positions). "Position health" could be represented by `redeemableCount` (positions needing attention) or a ratio metric. Keep it simple -- the existing 4-metric layout works.

3. **Action label override on InscriptionListRow**
   - What we know: The component hardcodes "Lend"/"Swap" for action button labels. Portfolio needs "Repay"/"Claim"/"Cancel".
   - Recommendation: Add `actionLabel?: string` prop. Minimal change, backward compatible.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `portfolio/page.tsx` (407 lines), `usePortfolio.ts` (293 lines), `InscriptionListRow.tsx` (243 lines), `SummaryBar.tsx` (81 lines), `PositionCard.tsx` (193 lines), `InscriptionActions.tsx` (347 lines), `transactions.ts`
- Phase 1 verification report confirming TanStack Query migration of usePortfolio

### Secondary (MEDIUM confidence)
- Architecture research document patterns (state layer model, query key hierarchy)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, everything already installed
- Architecture: HIGH -- all components exist, gap analysis based on direct code reading
- Pitfalls: HIGH -- identified from actual code inspection (missing props, hook rules, label mismatches)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependencies to change)
