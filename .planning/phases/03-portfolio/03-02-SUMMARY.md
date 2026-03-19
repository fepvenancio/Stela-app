---
phase: 03-portfolio
plan: 02
subsystem: ui
tags: [react, starknet, snip-12, portfolio, actions, summary-bar]

requires:
  - phase: 03-portfolio-01
    provides: actionLabel prop, computePortfolioSummary, SummaryBar interface, PortfolioSummaryInput Pick type
provides:
  - PortfolioInscriptionRow wrapper with transaction hooks for repay/cancel/liquidate/redeem
  - PortfolioOrderRow wrapper with SNIP-12 CancelOrder signing
  - SummaryBar rendering with computed metrics on portfolio page
  - signedAt passed through for countdown timers
affects: []

tech-stack:
  added: []
  patterns:
    - "Wrapper components to satisfy React hook rules (no conditional hooks)"
    - "SNIP-12 typed data signing via useWalletSign for off-chain order cancellation"

key-files:
  created:
    - apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx
    - apps/web/src/components/portfolio/PortfolioOrderRow.tsx
  modified:
    - apps/web/src/app/portfolio/page.tsx

key-decisions:
  - "Wrapper components instantiate all 4 transaction hooks unconditionally to satisfy React rules"
  - "AssetRow.value null coalesced to '0' for DebtAssetInfo compatibility"

patterns-established:
  - "Wrapper pattern: thin client component wrapping list row with hooks, used for portfolio actions"

requirements-completed: [PORT-01, PORT-02, PORT-03]

duration: 4min
completed: 2026-03-19
---

# Phase 03 Plan 02: Portfolio SummaryBar and Action Wiring Summary

**Portfolio page with SummaryBar metrics, inline action buttons (Repay/Claim/Cancel/Liquidate), signedAt countdown timers, and SNIP-12 order cancellation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T02:17:32Z
- **Completed:** 2026-03-19T02:21:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PortfolioInscriptionRow wires 4 transaction hooks based on inscription status and user role
- PortfolioOrderRow handles SNIP-12 CancelOrder signing before API call, matching OrderActions.tsx pattern
- SummaryBar renders above tabs with Total Lent, Total Borrowed, Redeemable count, Active Orders
- signedAt passed through to InscriptionListRow for countdown timers on filled positions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PortfolioInscriptionRow and PortfolioOrderRow wrapper components** - `2f32f9b` (feat)
2. **Task 2: Wire SummaryBar and action rows into portfolio page** - `4a96d52` (feat)

## Files Created/Modified
- `apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx` - Wrapper component connecting transaction hooks to inscription rows based on status/role
- `apps/web/src/components/portfolio/PortfolioOrderRow.tsx` - Wrapper component for SNIP-12 signed order cancellation
- `apps/web/src/app/portfolio/page.tsx` - Integrated SummaryBar, replaced InscriptionList/OrderListRow with wrapper components

## Decisions Made
- Wrapper components instantiate all 4 transaction hooks unconditionally to satisfy React hook rules (hooks cannot be conditional)
- AssetRow.value null-coalesced to '0' for DebtAssetInfo type compatibility (Rule 1 - Bug fix)
- Query invalidation uses `['portfolio']` prefix (not `queryKeys.portfolio._def` which doesn't exist)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null value in DebtAssetInfo mapping**
- **Found during:** Task 1 (PortfolioInscriptionRow)
- **Issue:** AssetRow.value is `string | null` but DebtAssetInfo.value requires `string`, causing type error
- **Fix:** Added `?? '0'` null coalescing when mapping asset values
- **Files modified:** apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx
- **Verification:** Build passes with no type errors
- **Committed in:** 2f32f9b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type compatibility fix. No scope creep.

## Issues Encountered
- Pre-existing lint infrastructure issue (circular JSON in ESLint config) -- out of scope, not caused by changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All PORT requirements (PORT-01, PORT-02, PORT-03) delivered
- Portfolio page fully functional with summary stats, inline actions, and countdown timers

---
*Phase: 03-portfolio*
*Completed: 2026-03-19*
