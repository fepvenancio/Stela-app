---
phase: 03-portfolio
plan: 01
subsystem: ui
tags: [react, portfolio, components, utility]

requires:
  - phase: 01-data-layer
    provides: TanStack Query, usePortfolio hook, PortfolioData type
provides:
  - actionLabel prop on InscriptionListRow and OrderListRow
  - computePortfolioSummary pure function in portfolio-utils.ts
  - PortfolioSummary.totalBorrowed replacing collateralLocked
affects: [03-portfolio]

tech-stack:
  added: []
  patterns: [Pick type for minimal function params, optional prop with nullish coalescing fallback]

key-files:
  created:
    - apps/web/src/lib/portfolio-utils.ts
  modified:
    - apps/web/src/components/InscriptionListRow.tsx
    - apps/web/src/components/OrderListRow.tsx
    - apps/web/src/components/portfolio/SummaryBar.tsx

key-decisions:
  - "totalBorrowed aggregates debt assets (not collateral) from active borrowing positions"
  - "PortfolioSummaryInput uses Pick<PortfolioData, ...> to avoid requiring full PortfolioData with stubs"

patterns-established:
  - "Optional prop with nullish coalescing: actionLabel ?? (defaultExpr) pattern for backward-compatible label overrides"

requirements-completed: [PORT-01, PORT-02]

duration: 3min
completed: 2026-03-19
---

# Phase 03 Plan 01: Portfolio Building Blocks Summary

**actionLabel prop on list row components and computePortfolioSummary utility for portfolio page wiring**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T02:12:31Z
- **Completed:** 2026-03-19T02:15:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added actionLabel prop to InscriptionListRow and OrderListRow for portfolio-specific button labels (Repay, Claim, Cancel)
- Created computePortfolioSummary pure function that aggregates PortfolioData into SummaryBar metrics
- Renamed collateralLocked to totalBorrowed in SummaryBar interface per UI-SPEC

## Task Commits

Each task was committed atomically:

1. **Task 1: Add actionLabel prop to InscriptionListRow and OrderListRow** - `c0362ef` (feat)
2. **Task 2: Create computePortfolioSummary and update SummaryBar interface** - `bfff8a7` (feat)

## Files Created/Modified
- `apps/web/src/lib/portfolio-utils.ts` - Pure utility with computePortfolioSummary and aggregateAssets helper
- `apps/web/src/components/InscriptionListRow.tsx` - Added actionLabel prop with nullish coalescing fallback
- `apps/web/src/components/OrderListRow.tsx` - Added actionLabel prop with nullish coalescing fallback
- `apps/web/src/components/portfolio/SummaryBar.tsx` - Renamed collateralLocked to totalBorrowed, updated label and tooltip

## Decisions Made
- totalBorrowed aggregates debt assets from borrowing positions (not collateral) per UI-SPEC requirement
- PortfolioSummaryInput uses Pick<PortfolioData, 'lending' | 'borrowing' | 'redeemable' | 'borrowingOrders' | 'lendingOrders'> to avoid forcing callers to construct full PortfolioData with stub loading/pagination fields

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now wire computePortfolioSummary into the portfolio page and pass actionLabel to list row components
- SummaryBar interface is updated and ready for data binding

---
*Phase: 03-portfolio*
*Completed: 2026-03-19*
