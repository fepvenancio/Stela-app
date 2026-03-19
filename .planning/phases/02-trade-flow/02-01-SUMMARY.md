---
phase: 02-trade-flow
plan: 01
subsystem: ui
tags: [nuqs, url-state, orderbook, fee-breakdown, next.js, trade]

# Dependency graph
requires:
  - phase: 01-data-layer
    provides: TanStack Query setup, NuqsAdapter in provider stack
provides:
  - nuqs-based two-way URL state binding for Trade page (debtToken, collateralToken, mode, amount)
  - OrderBook mounted on Trade page with duration filter
  - FeeBreakdown on all signing paths (TradeForm, AdvancedForm, SettlementDrawer)
affects: [02-trade-flow]

# Tech tracking
tech-stack:
  added: [nuqs useQueryState, parseAsStringLiteral, parseAsString]
  patterns: [nuqs tradeParsers module for URL state, prop-drilling URL params to child forms]

key-files:
  created:
    - apps/web/src/app/trade/search-params.ts
  modified:
    - apps/web/src/app/trade/page.tsx
    - apps/web/src/components/QuickLendModal.tsx

key-decisions:
  - "nuqs parsers in separate search-params.ts module for reuse by Markets page links"
  - "mode defaults to 'lend' via parseAsStringLiteral withDefault"
  - "OrderBook positioned between form and InfoSections per UI-SPEC visual hierarchy"
  - "FeeBreakdown added to TradeForm (lend/swap); AdvancedForm already had it; SettlementDrawer uses inline useFeePreview"

patterns-established:
  - "nuqs search-params module pattern: export parsers object, import in page component"
  - "Prop-drill URL params to child form components instead of each reading useSearchParams independently"

requirements-completed: [NAV-01, NAV-02, TRADE-01, TRADE-02]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 02 Plan 01: Trade Page URL State + OrderBook Summary

**nuqs two-way URL state binding for Trade page with OrderBook integration and fee visibility on all signing paths**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T01:07:53Z
- **Completed:** 2026-03-19T01:14:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migrated Trade page from useSearchParams to nuqs for type-safe two-way URL state (debtToken, collateralToken, mode, amount)
- Mounted OrderBook component on Trade page below form, conditionally rendered when both tokens selected
- Added FeeBreakdown to TradeForm (lend/swap modes) -- all signing paths now show fee information

## Task Commits

Each task was committed atomically:

1. **Task 1: Create nuqs search-params module and migrate Trade page URL state** - `e9b42c3` (feat)
2. **Task 2: Mount OrderBook on Trade page and verify fee visibility** - `83c7ba3` (feat)

## Files Created/Modified
- `apps/web/src/app/trade/search-params.ts` - nuqs parser definitions for trade URL params (debtToken, collateralToken, mode, amount)
- `apps/web/src/app/trade/page.tsx` - Migrated to nuqs, added OrderBook + FeeBreakdown to TradeForm
- `apps/web/src/components/QuickLendModal.tsx` - Fixed pre-existing type errors (bigint values, removed invalid contractAddress param)

## Decisions Made
- nuqs parsers exported from separate `search-params.ts` module for potential reuse by Markets page link generation
- Mode defaults to 'lend' via `parseAsStringLiteral` with `withDefault('lend')`
- OrderBook positioned between form div and InfoSections, matching UI-SPEC visual hierarchy (Form > OrderBook > Info)
- FeeBreakdown type dynamically set based on mode (`isLend ? 'lending' : 'swap'`) in TradeForm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing QuickLendModal type errors**
- **Found during:** Task 1 (build verification)
- **Issue:** QuickLendModal.tsx had two pre-existing type errors: `value` passed as string instead of bigint, `token_id` as string instead of bigint, and `contractAddress` passed to `getInscriptionOrderTypedData` which doesn't accept it. Also missing `debtCount`, `interestCount`, `collateralCount` params.
- **Fix:** Changed `value: rawAmount.toString()` to `value: rawAmount`, `token_id: '0'` to `token_id: 0n`, removed `contractAddress`, added count params.
- **Files modified:** apps/web/src/components/QuickLendModal.tsx
- **Verification:** Build passes
- **Committed in:** e9b42c3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for build to pass. QuickLendModal was created by a prior plan but had type errors against the current SDK version.

## Issues Encountered
- ESLint has a pre-existing circular plugin config error (`web:lint` fails). Not related to this plan's changes. Build and type-checking pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trade page now has full URL state binding, ready for Markets page to link with pre-filled params
- OrderBook is mounted and wired, ready for real-time data once API routes are deployed
- Fee visibility complete on all signing paths

---
*Phase: 02-trade-flow*
*Completed: 2026-03-19*
