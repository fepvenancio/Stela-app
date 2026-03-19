# Phase 2: Trade Flow - Research

**Researched:** 2026-03-19
**Domain:** State-preserving navigation, order book display, fee visibility
**Confidence:** HIGH

## Summary

Phase 2 builds on the state infrastructure established in Phase 1 (TanStack Query, nuqs, Zustand). The primary work is: (1) replacing the trade page's raw `useSearchParams` with nuqs for type-safe URL state that survives navigation and enables shareable links, (2) integrating the existing `OrderBook` component (currently only used on `/markets/[pair]`) into the trade page with rate-sorted display, (3) ensuring the existing `FeeBreakdown` component is visible before signing on all transaction paths, and (4) adding quick-action lend/swap buttons on the Markets page.

The codebase is in excellent shape for this phase. All the building blocks exist:
- `useOrderBook` hook with TanStack Query (30s polling, proper query keys)
- `OrderBook` + `LendingBook` + `SwapBook` components with APR-sorted display and cumulative depth bars
- `FeeBreakdown` component with Genesis NFT discount calculation
- `BestTradesPanel` with ranked trade display and fill actions
- `PairCard` already has a Trade button linking to `/trade?debtToken=...&collateralToken=...`
- nuqs adapter already installed and wired into providers

The primary gap is that the trade page uses `useSearchParams` directly (3 call sites) instead of nuqs, and the `OrderBook` component is only used on the market detail page, not on the trade page itself. The aggregation preview for blended rates needs to be computed from the order book data (the `multi-match.ts` `selectOrders` function already handles optimal order selection with DP/greedy algorithms).

**Primary recommendation:** Wire nuqs into trade page URL params, mount `OrderBook` component alongside the existing `BestTradesPanel`, compute blended rate preview from `selectOrders` output, and add quick-lend buttons to `PairCard`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | User selections on Browse/Markets persist when navigating to Trade page via URL params | nuqs already installed; PairCard already links to `/trade?debtToken=...&collateralToken=...`; trade page reads params via `useSearchParams` -- needs migration to nuqs for proper two-way binding |
| NAV-02 | User can share a trade link with pre-filled pair, mode, and amount | nuqs `useQueryState` with `shallow: false` makes URL the source of truth; amount param needs adding to URL schema |
| NAV-03 | User can lend/swap directly from Browse page via quick-action without full page navigation | PairCard has a Trade button but it navigates to /trade; needs inline quick-lend modal or action that triggers signing directly |
| TRADE-01 | Order book displays offers sorted by best interest rate first | OrderBook API already sorts by APR (line 335: `lendingLevels.sort((a, b) => b.apr - a.apr)`); OrderBook component exists but is not mounted on trade page |
| TRADE-02 | Fee breakdown is clearly displayed before user signs any transaction | FeeBreakdown component exists and is already used on trade page (line 998); needs verification it appears on ALL signing paths (quick-lend, settlement drawer, etc.) |
| TRADE-03 | User can see aggregated match preview showing which offers will fill their order and at what blended rate | BestTradesPanel ranks trades by score; `selectOrders` in multi-match.ts does optimal subset selection; need to compute blended rate from selected orders and display it |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| nuqs | ^2.8.9 | Type-safe URL search params | Installed, adapter wired, NOT used on trade page |
| @tanstack/react-query | ^5.91.x | Server state (order book, orders) | Installed, active, useOrderBook uses it |
| zustand | ^5.0.12 | Client ephemeral state (batch selection) | Installed, active |

### No new dependencies needed

This phase requires zero new package installs. All tools are already in the project.

## Architecture Patterns

### Recommended Approach

```
Markets/Browse Page               Trade Page
------------------                ----------
[PairCard]                        nuqs reads URL params:
  |-- Trade btn --> /trade?         debtToken, collateralToken, mode, amount
  |-- Quick Lend --> modal/drawer
                                  useOrderBook(debtToken, collateralToken)
                                    |
                                  OrderBook (sorted display)
                                    |
                                  BestTradesPanel (fill actions)
                                    |
                                  Blended rate preview (from selectOrders)
                                    |
                                  FeeBreakdown (always visible pre-sign)
                                    |
                                  Sign & Submit
```

### Pattern 1: nuqs URL State on Trade Page

**What:** Replace 3 `useSearchParams` call sites in `trade/page.tsx` with nuqs `useQueryState`.

**Current state (lines 658, 1811, 1813-1818):**
```typescript
const searchParams = useSearchParams()
const initialDebtToken = searchParams.get('debtToken') ?? undefined
const initialCollateralToken = searchParams.get('collateralToken') ?? undefined
const rawMode = searchParams.get('mode')
const initialMode: TradeMode = rawMode === 'swap' ? 'swap' : rawMode === 'advanced' ? 'advanced' : 'lend'
```

**Target:**
```typescript
import { useQueryState, parseAsStringLiteral } from 'nuqs'

const [debtToken, setDebtToken] = useQueryState('debtToken')
const [collateralToken, setCollateralToken] = useQueryState('collateralToken')
const [mode, setMode] = useQueryState('mode', parseAsStringLiteral(['lend', 'swap', 'advanced']).withDefault('lend'))
const [amount, setAmount] = useQueryState('amount')
```

**Key benefit:** Two-way binding -- when user changes token selection on trade page, URL updates automatically, making the link shareable at any point.

### Pattern 2: Order Book Integration on Trade Page

**What:** Mount the existing `OrderBook` component on the trade page, fed by `useOrderBook` hook.

**Current state:** Trade page uses `BestTradesPanel` which shows matched orders for the user's specific order. The `OrderBook` component (APR-sorted aggregate view) only lives on `/markets/[pair]`.

**Target:** Show `OrderBook` alongside the trade form so users can see market depth before creating their order. The `BestTradesPanel` remains for showing which specific orders match after the user fills in their form.

### Pattern 3: Blended Rate Preview

**What:** When `selectOrders` returns multiple matches, compute and display the blended (weighted-average) interest rate.

**Computation:**
```typescript
function computeBlendedRate(selected: SelectedOrder[]): number {
  let totalDebt = 0n
  let weightedRate = 0n
  for (const s of selected) {
    // Get per-order APR from order data
    const apr = getOrderAPR(s) // extract from order_data
    totalDebt += s.giveAmount
    weightedRate += s.giveAmount * BigInt(Math.round(apr * 1000))
  }
  if (totalDebt === 0n) return 0
  return Number(weightedRate / totalDebt) / 1000
}
```

### Pattern 4: Quick-Action from Browse

**What:** Add a quick-lend action to PairCard that opens a lightweight drawer/modal without navigating to `/trade`.

**Options (Claude's discretion):**
1. **Modal approach:** Click "Quick Lend" on PairCard, opens a modal with amount input + FeeBreakdown + sign button. Uses `useOrderForm` hook directly.
2. **Drawer approach:** Similar but slides in from the right, less disruptive to browse context.
3. **Inline expansion:** PairCard expands to show a mini trade form inline.

**Recommendation:** Modal approach. It reuses the existing trade form components, keeps the browse page intact, and is the simplest to implement. The modal can import the same `TokenBox` and `OrderSettings` components used on the trade page.

### Anti-Patterns to Avoid

- **Duplicating URL state in Zustand:** The debtToken/collateralToken/mode belong in nuqs (URL), not in a Zustand store. Only ephemeral form draft state (amounts being typed) goes in Zustand.
- **Reading useSearchParams alongside nuqs:** Once migrated, remove ALL `useSearchParams` usage from trade page. Mixing the two causes hydration mismatches.
- **Fetching order book without tokens selected:** Guard `useOrderBook` with `enabled: Boolean(debtToken && collateralToken)` (already done in the hook).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL param serialization | Manual `searchParams.get/set` | nuqs `useQueryState` | Type safety, shallow updates, default values |
| Order book sorting | Custom sort in component | API already sorts (orderbook route line 335) | Server sorts once, client displays |
| Optimal order selection | Greedy pick | `selectOrders` from `multi-match.ts` | Already implements DP/meet-in-the-middle for optimal subset-sum |
| Fee calculation | Manual BPS math | `useFeePreview` hook + `FeeBreakdown` component | Already handles Genesis NFT discount, volume tiers, floor BPS |
| Order matching detection | Custom match logic | `useInstantSettle` + `useMatchDetection` hooks | Already scan both off-chain and on-chain matches |

## Common Pitfalls

### Pitfall 1: nuqs Hydration Mismatch with Suspense

**What goes wrong:** nuqs `useQueryState` reads URL params which may differ between server and client render, causing hydration errors.
**Why it happens:** Next.js App Router renders server-side where searchParams may be empty, but client has them.
**How to avoid:** Wrap trade page content in `<Suspense>` boundary (already done -- `TradeContent` is wrapped). Ensure nuqs values have `.withDefault()` to avoid undefined/null mismatches.
**Warning signs:** React hydration warning in console, flickering values on page load.

### Pitfall 2: Trade Page is 1800+ Lines

**What goes wrong:** The trade page (`trade/page.tsx`) is extremely large (~1800 lines) with 3 form variants (SwapForm, LendForm, AdvancedForm) plus helper components all in one file.
**Why it matters:** Any modification risks breaking unrelated sections. Each form has its own `useSearchParams` usage that needs independent migration.
**How to avoid:** Migrate nuqs at the top level (`TradeContent` component, line 1810) and pass down as props, rather than migrating inside each form independently. Consider extracting forms to separate files as part of the work.
**Warning signs:** Import cycles, prop drilling 5+ levels deep.

### Pitfall 3: Order Book Data vs Match Detection Confusion

**What goes wrong:** The `OrderBook` component shows aggregate market data (APR levels with depth), while `BestTradesPanel` shows specific matches for the user's order. These serve different purposes but could be confused.
**Why it happens:** Both involve "order lists sorted by rate" but at different abstraction levels.
**How to avoid:** OrderBook = market overview (shows before user fills form), BestTradesPanel = personal matches (shows after user specifies what they want). Keep both, don't merge them.

### Pitfall 4: Quick-Lend Requires Wallet Connection

**What goes wrong:** Quick-lend button on Browse page triggers signing, but user may not have wallet connected.
**How to avoid:** Use the existing `Web3ActionWrapper` component which shows connect-wallet UI when no wallet is connected. Wrap the quick-lend action in it.

### Pitfall 5: Amount in URL vs Precision

**What goes wrong:** Token amounts have 18 decimal precision. Encoding raw bigint values in URLs creates ugly, unreadable links.
**How to avoid:** Encode human-readable amounts in URL (e.g., `amount=100.5`), parse to raw bigint only when needed for contract calls. Use nuqs `parseAsFloat` or custom parser.

## Code Examples

### Example 1: nuqs Trade Page Setup

```typescript
// apps/web/src/app/trade/search-params.ts
import { parseAsStringLiteral, parseAsString, createSearchParamsCache } from 'nuqs/server'

export const tradeParsers = {
  debtToken: parseAsString,
  collateralToken: parseAsString,
  mode: parseAsStringLiteral(['lend', 'swap', 'advanced']).withDefault('lend'),
  amount: parseAsString,
}

// In component:
import { useQueryState, parseAsStringLiteral } from 'nuqs'

function TradeContent() {
  const [debtToken, setDebtToken] = useQueryState('debtToken')
  const [collateralToken, setCollateralToken] = useQueryState('collateralToken')
  const [mode, setMode] = useQueryState('mode',
    parseAsStringLiteral(['lend', 'swap', 'advanced']).withDefault('lend')
  )
  const [amount, setAmount] = useQueryState('amount')

  // Tab change updates URL
  const handleTabChange = (tab: TradeMode) => {
    setMode(tab)
  }
  // ...
}
```

### Example 2: Order Book on Trade Page

```typescript
// Inside TradeContent or a sub-component
const { data: orderBookData, isLoading: obLoading } = useOrderBook(
  debtToken ?? '',
  collateralToken ?? '',
)

// Render alongside trade form
{debtToken && collateralToken && (
  <OrderBook
    data={orderBookData}
    isLoading={obLoading}
    mode={mode === 'swap' ? 'swap' : 'lending'}
    duration={durationFilter}
    onDurationChange={setDurationFilter}
  />
)}
```

### Example 3: Quick-Lend from PairCard

```typescript
// In PairCard or a wrapper
function QuickLendButton({ pair }: { pair: PairAggregate }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)} className="...">
        Quick Lend
      </button>
      {showModal && (
        <QuickLendModal
          debtToken={pair.debt_token}
          collateralToken={pair.collateral_token}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
```

### Example 4: Blended Rate in BestTradesPanel/InlineMatchList

```typescript
// Compute from selection
const blendedAPR = useMemo(() => {
  if (!multiSettleSelection || multiSettleSelection.selected.length === 0) return null
  let totalWeight = 0n
  let weightedSum = 0
  for (const s of multiSettleSelection.selected) {
    const apr = s.type === 'offchain'
      ? computeYieldPercent(
          toFilterable(s.order.order_data.debtAssets ?? []),
          toFilterable(s.order.order_data.interestAssets ?? [])
        )
      : computeYieldPercent(
          toFilterable(s.match.debtAssets ?? []),
          toFilterable(s.match.interestAssets ?? [])
        )
    if (apr !== null) {
      weightedSum += apr * Number(s.giveAmount)
      totalWeight += s.giveAmount
    }
  }
  if (totalWeight === 0n) return null
  return weightedSum / Number(totalWeight)
}, [multiSettleSelection])
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 2) | Impact |
|------------------------|------------------------|--------|
| `useSearchParams` on trade page | nuqs `useQueryState` | Type-safe, two-way URL binding, shareable links |
| No order book on trade page | `OrderBook` component mounted | Users see market depth before creating orders |
| BestTradesPanel shows matches but no blended rate | Add weighted-average rate display | Users understand aggregate cost of partial fills |
| Trade button on PairCard navigates away | Quick-lend modal/drawer on Browse | Fewer clicks to execute a trade |
| FeeBreakdown on trade page only | FeeBreakdown in quick-lend modal too | Fees visible on all signing paths |

## Existing Component Inventory

Components and hooks that already exist and should be reused (not rebuilt):

| Component/Hook | Location | Current Usage | Phase 2 Usage |
|---------------|----------|---------------|---------------|
| `OrderBook` | `components/orderbook/OrderBook.tsx` | `/markets/[pair]` only | Mount on trade page |
| `LendingBook` | `components/orderbook/LendingBook.tsx` | Inside OrderBook | No change |
| `SwapBook` | `components/orderbook/SwapBook.tsx` | Inside OrderBook | No change |
| `OrderBookRow` | `components/orderbook/OrderBookRow.tsx` | Inside LendingBook/SwapBook | No change |
| `BestTradesPanel` | `components/trade/BestTradesPanel.tsx` | Trade page | Keep, add blended rate |
| `InlineMatchList` | `components/InlineMatchList.tsx` | Trade page | Keep, ensure fee visible |
| `FeeBreakdown` | `components/FeeBreakdown.tsx` | Trade page (line 998) | Add to quick-lend modal |
| `PairCard` | `components/PairCard.tsx` | Markets page | Add quick-lend button |
| `useOrderBook` | `hooks/useOrderBook.ts` | `/markets/[pair]` | Use on trade page |
| `useFeePreview` | `hooks/useFeePreview.ts` | FeeBreakdown | No change |
| `selectOrders` | `lib/multi-match.ts` | Trade page matching | Use for blended rate calc |
| `useOrderForm` | `hooks/useOrderForm.ts` | Trade page forms | Reuse in quick-lend |
| `SettlementDrawer` | `components/trade/SettlementDrawer.tsx` | Trade page | Ensure FeeBreakdown inside |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None -- Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | URL params populate trade form on navigation | manual-only | Visual: click PairCard Trade btn, verify trade page pre-filled | N/A |
| NAV-02 | Shared URL opens with correct state | manual-only | Visual: paste URL with params, verify state | N/A |
| NAV-03 | Quick-lend from Browse page works | manual-only | Visual: click Quick Lend, verify modal + signing | N/A |
| TRADE-01 | Order book sorted by best rate | unit | Test OrderBook API response sorting | Wave 0 |
| TRADE-02 | Fee breakdown visible pre-sign | manual-only | Visual: check all signing paths show FeeBreakdown | N/A |
| TRADE-03 | Aggregated match preview with blended rate | unit | Test blended rate computation | Wave 0 |

### Sampling Rate
- **Per task commit:** Lint + type check (`pnpm lint && pnpm build`)
- **Per wave merge:** Full build
- **Phase gate:** Visual verification of all 5 success criteria

### Wave 0 Gaps
- No test framework installed -- would need vitest setup to unit test blended rate computation and API sorting
- Most requirements are UI/UX and best verified visually
- `pnpm lint` and `pnpm build` serve as the primary automated checks

## Open Questions

1. **Quick-lend UX pattern**
   - What we know: PairCard has a Trade button. NAV-03 requires action without full navigation.
   - What's unclear: Modal vs drawer vs inline expansion. Modal is simplest.
   - Recommendation: Modal with amount input + FeeBreakdown + sign. Can iterate on UX later.

2. **Order book placement on trade page**
   - What we know: Trade page is already 1800+ lines. OrderBook component exists.
   - What's unclear: Side panel vs below form vs tabbed view.
   - Recommendation: Below the trade form, above BestTradesPanel. Shows market context before matches.

3. **Amount in shareable URLs**
   - What we know: NAV-02 requires amount in URL. Amounts are bigint with 18 decimals.
   - What's unclear: Human-readable format vs raw.
   - Recommendation: Human-readable (e.g., `amount=100.5`). Parse with `parseAmount` utility that already exists.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in Component Inventory
- `apps/web/src/app/trade/page.tsx` -- 1800+ line trade page with 3 useSearchParams sites
- `apps/web/src/app/api/orderbook/[pair]/route.ts` -- order book API with APR sorting
- `apps/web/src/components/orderbook/` -- full order book component suite
- `apps/web/src/components/FeeBreakdown.tsx` -- fee display with Genesis discount
- `apps/web/src/lib/multi-match.ts` -- optimal order selection with DP algorithm

### Secondary (MEDIUM confidence)
- Phase 1 verification report confirms nuqs adapter, TanStack Query, Zustand all wired
- Research SUMMARY.md and ARCHITECTURE.md from initial research phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified working in Phase 1
- Architecture: HIGH -- all building blocks exist, just need wiring/composition
- Pitfalls: HIGH -- identified from direct code analysis of 1800-line trade page
- Requirements mapping: HIGH -- each requirement maps to existing components + clear gaps

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependencies to go stale)
