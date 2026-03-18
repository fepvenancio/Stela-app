---
phase: 01-data-layer
plan: 01
subsystem: ui
tags: [tanstack-query, nuqs, zustand, react-query, state-management, provider-stack]

# Dependency graph
requires: []
provides:
  - QueryClientProvider with SSR-safe useState init pattern
  - NuqsAdapter for URL state management
  - Centralized query key factory (queryKeys) for all API queries
  - Zustand batch-selection store replacing Context-based BatchSelectionProvider
affects: [01-data-layer, 02-market-ux]

# Tech tracking
tech-stack:
  added: [nuqs, zustand, @tanstack/react-query-devtools]
  patterns: [useState-QueryClient-init, zustand-store-no-provider, query-key-factory]

key-files:
  created:
    - apps/web/src/lib/query-keys.ts
    - apps/web/src/stores/batch-selection.ts
  modified:
    - apps/web/src/app/providers.tsx
    - apps/web/src/hooks/useBatchSelection.tsx
    - apps/web/src/app/markets/[pair]/page.tsx
    - apps/web/package.json

key-decisions:
  - "QueryClient created via useState(() => new QueryClient()) to avoid SSR issues on Cloudflare Workers"
  - "Zustand count kept as derived property (not function) for backward compatibility with existing consumers"

patterns-established:
  - "Provider stack order: QueryClientProvider > NuqsAdapter > StarknetConfig"
  - "Query key factory pattern: queryKeys.namespace.method(params) as const"
  - "Zustand stores in apps/web/src/stores/ with re-exports from hooks/ for backward compat"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 01 Plan 01: State Management Foundation Summary

**TanStack Query provider with SSR-safe init, nuqs adapter, query key factory, and Zustand batch-selection store replacing React Context**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T23:53:30Z
- **Completed:** 2026-03-18T23:56:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Provider stack wraps entire app with QueryClientProvider (staleTime 10s, gcTime 5min, no refetchOnWindowFocus, retry 2) + NuqsAdapter + StarknetConfig
- Query key factory with 5 namespaces (inscriptions, orders, pairs, portfolio, shares) for cache management
- BatchSelectionProvider React Context replaced with Zustand store -- no provider wrapper needed, backward-compatible re-export

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create provider stack + query keys** - `464ddb3` (feat)
2. **Task 2: Replace BatchSelectionProvider with Zustand store** - `4d7a312` (feat)

## Files Created/Modified
- `apps/web/src/app/providers.tsx` - QueryClientProvider + NuqsAdapter wrapping StarknetConfig
- `apps/web/src/lib/query-keys.ts` - Centralized query key factory for all API queries
- `apps/web/src/stores/batch-selection.ts` - Zustand store replacing BatchSelectionProvider context
- `apps/web/src/hooks/useBatchSelection.tsx` - Re-export shim for backward compatibility
- `apps/web/src/app/markets/[pair]/page.tsx` - Removed BatchSelectionProvider wrapper
- `apps/web/package.json` - Added nuqs, zustand, @tanstack/react-query-devtools

## Decisions Made
- QueryClient created via `useState(() => new QueryClient())` pattern instead of module-level to avoid SSR issues on Cloudflare Workers
- Zustand `count` kept as a derived property (updated in `toggle`/`clearAll`) rather than a function, because existing consumers use `count === 0` and `{count}` as a value

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed count type from function to derived property**
- **Found during:** Task 2 (Zustand store creation)
- **Issue:** Plan specified `count: () => get().selected.size` as a function, but existing consumers in SelectionActionBar.tsx and LendReviewModal.tsx use `count` as a value (`count === 0`, `{count}`)
- **Fix:** Made `count` a numeric property updated in `toggle` and `clearAll` instead of a function
- **Files modified:** apps/web/src/stores/batch-selection.ts
- **Verification:** Build passes, all consumers work without changes
- **Committed in:** 4d7a312 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug prevention)
**Impact on plan:** Essential fix to prevent runtime errors in existing consumers. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provider stack ready for hook migrations (TanStack Query hooks can now use queryKeys)
- Zustand pattern established for future stores
- nuqs adapter wired in, ready for URL state parameters in browse/portfolio pages

## Self-Check: PASSED

All created files exist. All commit hashes verified.

---
*Phase: 01-data-layer*
*Completed: 2026-03-18*
