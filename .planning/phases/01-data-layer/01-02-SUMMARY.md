---
phase: 01-data-layer
plan: 02
subsystem: ui
tags: [tanstack-query, react-query, hooks, caching, invalidation]

requires:
  - phase: 01-data-layer/01
    provides: queryKeys factory, QueryClient provider, buildApiUrl utility
provides:
  - All simple data hooks migrated to TanStack Query useQuery
  - stela:sync event bus fully replaced with queryClient.invalidateQueries
  - Optimistic inscription creation via queryClient.setQueryData
  - Shared cache between useInscriptionDetail and useInscriptionAssets via select
affects: [01-data-layer/03, 02-browse-trade, 03-portfolio]

tech-stack:
  added: []
  patterns: [useQuery with queryKeys factory, queryClient.invalidateQueries for cross-hook sync, query cache subscription for contract read refetch]

key-files:
  created: []
  modified:
    - apps/web/src/hooks/usePairs.ts
    - apps/web/src/hooks/useInscriptionDetail.ts
    - apps/web/src/hooks/useInscriptionAssets.ts
    - apps/web/src/hooks/useOrderBook.ts
    - apps/web/src/hooks/useInscriptions.ts
    - apps/web/src/hooks/useOrders.ts
    - apps/web/src/hooks/useShareListings.ts
    - apps/web/src/hooks/useSync.ts
    - apps/web/src/hooks/useOrderForm.ts
    - apps/web/src/hooks/useMultiSettle.ts
    - apps/web/src/hooks/useInstantSettle.ts
    - apps/web/src/hooks/useRefinance.ts
    - apps/web/src/hooks/useRenegotiate.ts
    - apps/web/src/hooks/useCollateralSale.ts
    - apps/web/src/hooks/useBid.ts
    - apps/web/src/hooks/useAcceptCollectionOffer.ts
    - apps/web/src/hooks/useClaimCollateral.ts
    - apps/web/src/hooks/useShareTransfer.ts
    - apps/web/src/hooks/useStartAuction.ts
    - apps/web/src/hooks/useInscription.ts
    - apps/web/src/hooks/useShares.ts
    - apps/web/src/components/SellPositionModal.tsx
    - apps/web/src/hooks/api.ts
    - apps/web/src/hooks/usePairListings.ts
    - apps/web/src/hooks/usePortfolio.ts
    - apps/web/src/hooks/useInfiniteApi.ts

key-decisions:
  - "Removed stela:sync listeners from all files including pages/api.ts/usePortfolio (dead code after dispatcher removal)"
  - "Contract read hooks (useInscription, useShares) subscribe to query cache invalidation events for refetch"

patterns-established:
  - "useQuery pattern: queryKeys factory key + fetch queryFn + refetchInterval for polling"
  - "Cross-hook sync: queryClient.invalidateQueries() after mutations instead of custom events"
  - "Cache sharing: useInscriptionAssets uses select on same queryKey as useInscriptionDetail"

requirements-completed: [DATA-01, DATA-02, DATA-03]

duration: 8min
completed: 2026-03-19
---

# Phase 01 Plan 02: Hook Migration Summary

**All 8 simple data hooks migrated from useFetchApi to TanStack Query useQuery with preserved polling intervals, and all stela:sync event dispatchers/listeners replaced with queryClient.invalidateQueries across 23 files**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T23:59:02Z
- **Completed:** 2026-03-19T00:07:07Z
- **Tasks:** 2
- **Files modified:** 30

## Accomplishments
- Migrated usePairs, useInscriptionDetail, useInscriptionAssets, useOrderBook, useInscriptions, useOrders, useShareListings to useQuery with correct polling intervals
- useInscriptionAssets shares cache entry with useInscriptionDetail via select option (single fetch, two consumers)
- addOptimisticInscription now uses queryClient.setQueryData instead of custom stela:optimistic-create events
- All 13 stela:sync dispatchers replaced with queryClient.invalidateQueries
- Contract read hooks (useInscription, useShares) subscribe to query cache invalidation events
- Zero stela:sync references remain anywhere in apps/web/src/
- Full build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate simple useFetchApi hooks to useQuery** - `90172bb` (feat)
2. **Task 2: Replace stela:sync dispatchers and listeners** - `1ed0cc1` (feat)

## Files Created/Modified
- `apps/web/src/hooks/usePairs.ts` - useQuery with 15s polling
- `apps/web/src/hooks/useInscriptionDetail.ts` - useQuery with shared cache key
- `apps/web/src/hooks/useInscriptionAssets.ts` - useQuery with select for cache sharing
- `apps/web/src/hooks/useOrderBook.ts` - useQuery with 30s polling
- `apps/web/src/hooks/useInscriptions.ts` - useQuery with 15s polling + optimistic setQueryData
- `apps/web/src/hooks/useOrders.ts` - useQuery with 30s/5s polling
- `apps/web/src/hooks/useShareListings.ts` - useQuery with 30s polling
- `apps/web/src/hooks/useSync.ts` - invalidateQueries instead of stela:sync dispatch
- `apps/web/src/hooks/useOrderForm.ts` - invalidateQueries + updated addOptimisticInscription calls
- `apps/web/src/hooks/useInscription.ts` - query cache subscription for refetch
- `apps/web/src/hooks/useShares.ts` - query cache subscription for refetch
- 12 additional hooks/components - stela:sync dispatch replaced with invalidateQueries
- 4 page files + 4 utility hooks - dead stela:sync listeners removed

## Decisions Made
- Removed stela:sync listeners from files outside the plan's explicit scope (api.ts, usePairListings, usePortfolio, useInfiniteApi, 4 page components) because they were dead code after all dispatchers were removed -- no source of stela:sync events remains
- Contract read hooks subscribe to TanStack Query cache invalidation events rather than polling, matching the plan's recommended approach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead stela:sync listeners from 8 additional files**
- **Found during:** Task 2
- **Issue:** After replacing all stela:sync dispatchers, 8 files (api.ts, usePairListings, usePortfolio, useInfiniteApi, 4 page components) still had stela:sync listeners that would never fire
- **Fix:** Removed the dead listener code from all 8 files
- **Files modified:** api.ts, usePairListings.ts, usePortfolio.ts, useInfiniteApi.ts, trade/page.tsx, inscription/[id]/page.tsx, markets/page.tsx, stela/[id]/page.tsx
- **Verification:** grep confirms zero stela:sync references remain; build passes
- **Committed in:** 1ed0cc1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 dead code removal)
**Impact on plan:** Essential cleanup -- dead listeners would never fire and constituted confusing dead code.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All hooks now use TanStack Query -- Plan 03 (URL state with nuqs) can proceed
- queryKeys factory is fully wired into all data hooks
- useFetchApi still exists in api.ts for usePortfolio (will be migrated in a later plan)

---
*Phase: 01-data-layer*
*Completed: 2026-03-19*
