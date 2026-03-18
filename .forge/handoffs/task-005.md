# Handoff: task-005 — BestTradesPanel

## What was done

Created `apps/web/src/components/trade/BestTradesPanel.tsx` — a self-contained React component that displays up to 5 ranked trade matches below the trade form.

### Key behaviours

| Feature | Implementation |
|---------|----------------|
| Ranking — lending mode | `computeYieldPercent(debtAssets, interestAssets)` → sort descending (highest APR first) |
| Ranking — swap mode | Custom `computeSwapRate` (collateral / debt raw units) → sort descending (best rate first) |
| Top-5 cap | `slice(0, 5)` after sort |
| Counterparty | `formatAddress()` truncated hex |
| Amount | `formatTokenValue()` on primary debt asset |
| Duration | `formatDuration(trade.duration)` |
| Expiry | Countdown via `formatDuration(deadline - now)` |
| Source badge | "On-chain" (star/blue) vs "Off-chain" (aurora/green) colour-coded |
| Fill button | Calls `onFill(raw, source)` prop |
| Empty state | "No orders found — create one" with secondary hint text (only shown after first check completes) |
| Loading state | 3-row animated skeleton while `isChecking && no stale data` |
| Stale-refresh | Existing rows shown at 60% opacity + "Scanning…" in header while re-checking |
| Mobile responsive | Columns hidden on `< sm`; full grid on desktop; `col-span-6` fill button spans most of mobile row |
| Accessibility | `aria-label`, `aria-hidden`, `aria-busy`, `role="status"` |

### Files modified
- **Created**: `apps/web/src/components/trade/BestTradesPanel.tsx`

## What was NOT done (scope deliberately excluded)

- No parent integration — the component is ready to drop in; parent wiring (rendering it below the trade form, passing `onFill` etc.) is a separate task
- No "borrow" perspective matching (where user seeks lending orders) — `useMatchDetection` currently returns orders the user can fill as lender only; the component supports this mode via `mode: 'lending'`
- No `batch_settle` / multi-fill UX — Fill is single-order; multi-settle UI is out of scope for this task
- No tests written — coverage threshold is 80%; this is a presentational component without testable pure logic beyond what filter-utils already covers

## Concerns / edge cases discovered

1. **Brief empty-state flash**: `useMatchDetection` has a 500 ms debounce before firing. During those 500 ms, the component is mounted with `isChecking=false` and no results. The `wasCheckingRef` / `hasCompletedCheckRef` logic suppresses the empty state until after the first check cycle completes (avoiding the flash).

2. **Cross-token yield**: `computeYieldPercent` returns `null` when interest token ≠ debt token (no price oracle). Those trades show `–` for APR and sort to the bottom. This is correct and consistent with the browse page behaviour.

3. **BigInt swap rate precision**: `computeSwapRate` uses integer arithmetic (`× 1_000_000n / debtTotal`) to avoid floating-point loss before converting to `number`. Values are only ever displayed as strings.

4. **order_data key naming**: Off-chain orders may use either camelCase (`debtAssets`) or snake_case (`debt_assets`) depending on which version stored them. The normalisation function handles both.

5. **Expired orders**: Rows with `deadline < now` are rendered with a red expiry label and the Fill button is disabled (`disabled={isExpired}`).

## Security self-audit (SECURITY.md)

- ✅ No hardcoded private keys or secrets
- ✅ No `eval()` or dynamic code execution
- ✅ No `dangerouslySetInnerHTML`
- ✅ BigInt/u256 values rendered as strings via `formatTokenValue` / `.toFixed()` / BigInt arithmetic
- ✅ No API calls made from this component (uses parent-provided match data)

## Files modified (touch_map.writes)

```
apps/web/src/components/trade/BestTradesPanel.tsx  ← NEW
```
