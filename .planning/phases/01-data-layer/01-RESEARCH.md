# Phase 1: Data Layer - Research

**Researched:** 2026-03-18
**Domain:** React server state management, URL state, client state infrastructure
**Confidence:** HIGH

## Summary

Phase 1 replaces the app's ad-hoc data fetching and state management with proper infrastructure. The app has `@tanstack/react-query@^5.90.21` as a dependency but uses it zero times. Instead, two custom hooks (`useFetchApi` and `useInfiniteApi`) manually re-implement caching, polling, race condition handling, and stale data management -- all worse than TanStack Query. A custom event bus (`stela:sync`) coordinates refetches across 20+ files via `window.dispatchEvent`. This phase activates TanStack Query, adds nuqs for URL state, adds Zustand for ephemeral client state, and migrates all data fetching hooks.

The migration scope is well-bounded: 10 hooks consume `useFetchApi`, 0 consume `useInfiniteApi` (portfolio does its own manual pagination), and `stela:sync` is dispatched in 12 places and listened in 14. The `usePortfolio` hook is the most complex consumer with 5 parallel `useFetchApi` calls plus 2 manual paginated fetches. All other hooks are straightforward single-endpoint fetches with optional polling.

**Primary recommendation:** Set up TanStack Query provider + nuqs adapter + Zustand stores in the app shell first, then migrate hooks one-by-one from simplest to most complex, keeping `useFetchApi` working alongside `useQuery` during transition.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | All API data fetching uses TanStack Query instead of custom useFetchApi/useInfiniteApi hooks | Migration inventory below identifies all 10 useFetchApi consumers + 2 manual pagination hooks. Query key hierarchy + per-hook migration patterns documented. |
| DATA-02 | Data polling updates in background without UI flicker (stale-while-revalidate) | TanStack Query's `staleTime` + `refetchInterval` replaces manual `setInterval` + loading state toggling. Pitfall 3 (hydration) and Pitfall 5 (rate limits) documented. |
| DATA-03 | Data auto-refreshes at appropriate intervals without manual page reload | Existing polling intervals mapped (5s, 15s, 30s per hook). TanStack Query `refetchInterval` replaces all manual `setInterval` patterns. `stela:sync` replaced by `queryClient.invalidateQueries()`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.91.0 (installed: ^5.90.21) | Server state management | Already a dependency, industry standard, replaces useFetchApi/useInfiniteApi |
| nuqs | ^2.8.9 | Type-safe URL search params | Preserves navigation state across pages, shareable links |
| zustand | ^5.0.12 | Ephemeral client state | Replaces BatchSelectionContext, handles trade form drafts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query-devtools | ^5.91.0 | Debug query cache during dev | Development only, tree-shaken in prod |

**Installation:**
```bash
# TanStack Query already installed -- just activate it
pnpm --filter web add nuqs zustand @tanstack/react-query-devtools
```

**Version verification:** Versions confirmed via npm registry on 2026-03-18:
- @tanstack/react-query: 5.91.0 (installed ^5.90.21 is compatible)
- nuqs: 2.8.9
- zustand: 5.0.12

## Architecture Patterns

### Provider Stack (providers.tsx)

The current `providers.tsx` only has `StarknetConfig`. After this phase:

```typescript
// apps/web/src/app/providers.tsx
'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { StarknetConfig, jsonRpcProvider } from '@starknet-react/core'
// ... existing starknet config ...

export function Providers({ children }: { children: React.ReactNode }) {
  // CRITICAL: Create QueryClient inside useState to avoid SSR/hydration issues
  // on Cloudflare Workers (stateless runtime, no persistent process)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,        // 10s -- prevent refetch on hydration
        gcTime: 5 * 60 * 1000,   // 5 min garbage collection
        refetchOnWindowFocus: false, // DeFi app: user may have multiple tabs
        retry: 2,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <StarknetConfig chains={chains} provider={provider} connectors={connectors} autoConnect>
          {children}
        </StarknetConfig>
      </NuqsAdapter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Query Key Hierarchy

```typescript
// apps/web/src/lib/query-keys.ts
export const queryKeys = {
  inscriptions: {
    all: ['inscriptions'] as const,
    list: (filters: { status?: string; address?: string; page?: number }) =>
      ['inscriptions', 'list', filters] as const,
    detail: (id: string) => ['inscriptions', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters: { status?: string; address?: string; page?: number }) =>
      ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    book: (debtToken: string, collateralToken: string) =>
      ['orders', 'book', debtToken, collateralToken] as const,
  },
  pairs: {
    all: ['pairs'] as const,
    listings: (debtToken: string, collateralToken: string) =>
      ['pairs', 'listings', debtToken, collateralToken] as const,
  },
  portfolio: {
    all: (address: string) => ['portfolio', address] as const,
    inscriptions: (address: string) => ['portfolio', address, 'inscriptions'] as const,
    orders: (address: string) => ['portfolio', address, 'orders'] as const,
    shares: (address: string) => ['portfolio', address, 'shares'] as const,
  },
  shares: {
    listings: (params: Record<string, string | undefined>) =>
      ['shares', 'listings', params] as const,
    detail: (id: string) => ['shares', 'detail', id] as const,
  },
} as const
```

### stela:sync Replacement

Current pattern (dispatched in 12 hooks + 3 pages):
```typescript
// BEFORE: scattered across useSync, useOrderForm, useMultiSettle, etc.
window.dispatchEvent(new Event('stela:sync'))
```

Replacement:
```typescript
// AFTER: centralized invalidation
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

// After any successful transaction/sync:
queryClient.invalidateQueries() // invalidate everything

// Or targeted:
queryClient.invalidateQueries({ queryKey: queryKeys.inscriptions.all })
queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
```

## Migration Inventory

### useFetchApi Consumers (10 hooks)

| Hook | Endpoint | Polling | Complexity | Migration Order |
|------|----------|---------|------------|-----------------|
| `usePairs` | `/api/pairs` | 15s | Simple | 1st |
| `useInscriptionDetail` | `/api/inscriptions/:id` | none | Simple | 2nd |
| `useInscriptionAssets` | `/api/inscriptions/:id` | none | Simple (shares queryFn with detail) | 3rd |
| `useOrderBook` | `/api/orderbook/:pair` | 30s | Simple | 4th |
| `useInscriptions` | `/api/inscriptions` | 15s | Medium (optimistic updates) | 5th |
| `useOrders` | `/api/orders` | 30s | Simple | 6th |
| `useOrder` (detail) | `/api/orders/:id` | 5s | Simple | 7th |
| `useShareListings` | `/api/share-listings` | 30s | Simple | 8th |
| `useShareListing` | `/api/share-listings/:id` | none | Simple | 9th |
| `usePortfolio` (5 useFetchApi calls + 2 manual fetches) | multiple | 30s | Complex | 10th (last) |

### Manual Fetch Hooks (not using useFetchApi)

| Hook | Pattern | Complexity |
|------|---------|------------|
| `usePortfolio` (inscriptions pagination) | Manual useState + fetch + stela:sync | High -- rewrite as useInfiniteQuery |
| `usePortfolio` (orders pagination) | Manual useState + fetch + stela:sync | High -- rewrite as useInfiniteQuery |
| `usePairListings` | Manual useState + fetch + stela:sync + setInterval | High -- rewrite as useInfiniteQuery |

### stela:sync Dispatchers (12 locations)

These all need to change from `window.dispatchEvent(new Event('stela:sync'))` to `queryClient.invalidateQueries()`:

| File | Hook/Function |
|------|---------------|
| `useSync.ts` | `sync()` |
| `useOrderForm.ts` | order submission success |
| `useMultiSettle.ts` | batch settle success |
| `useInstantSettle.ts` | instant settle success |
| `useRefinance.ts` | refinance success |
| `useRenegotiate.ts` (2 places) | renegotiate success |
| `useCollateralSale.ts` | collateral sale success |
| `useBid.ts` | bid success |
| `useAcceptCollectionOffer.ts` | accept offer success |
| `useClaimCollateral.ts` | claim success |
| `useShareTransfer.ts` (2 places) | transfer/buy success |
| `useStartAuction.ts` | auction start success |
| `SellPositionModal.tsx` | sell success |

### stela:sync Listeners (14 locations, to be removed)

| File | Pattern |
|------|---------|
| `api.ts` (useFetchApi) | Built into hook -- removed when hook deleted |
| `useInfiniteApi.ts` | Built into hook -- removed when hook deleted |
| `usePortfolio.ts` | Manual listener -- removed when migrated to useQuery |
| `usePairListings.ts` | Manual listener -- removed when migrated to useQuery |
| `useInscription.ts` | Contract read refetch on sync |
| `useShares.ts` | Contract read refetch on sync |
| `markets/page.tsx` | Page-level listener |
| `trade/page.tsx` | Page-level listener |
| `stela/[id]/page.tsx` | Page-level listener |
| `inscription/[id]/page.tsx` | Inline fetch + sync listener |
| `markets/[pair]/page.tsx` | Via BatchSelectionProvider |

### Zustand Store: Batch Selection

Replace `BatchSelectionProvider` (React Context) in `apps/web/src/hooks/useBatchSelection.tsx`:

```typescript
// apps/web/src/stores/batch-selection.ts
import { create } from 'zustand'

interface SelectedInscription { /* same as current */ }

interface BatchSelectionStore {
  selected: Map<string, SelectedInscription>
  toggle: (item: SelectedInscription) => void
  isSelected: (id: string) => boolean
  clearAll: () => void
  count: () => number
}

export const useBatchSelection = create<BatchSelectionStore>((set, get) => ({
  selected: new Map(),
  toggle: (item) => set((state) => {
    const next = new Map(state.selected)
    if (next.has(item.id)) next.delete(item.id)
    else if (next.size < 10) next.set(item.id, item)
    return { selected: next }
  }),
  isSelected: (id) => get().selected.has(id),
  clearAll: () => set({ selected: new Map() }),
  count: () => get().selected.size,
}))
```

Benefits: No provider wrapper needed. Selector-based subscriptions prevent unnecessary re-renders. Currently only used in `markets/[pair]/page.tsx`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request deduplication | Manual refs/flags in useFetchApi | TanStack Query (automatic) | Same queryKey = same request, guaranteed |
| Stale-while-revalidate | Manual `isLoading: !prev.data` pattern | TanStack Query staleTime | Battle-tested, handles edge cases (race conditions, unmount) |
| Polling with cleanup | Manual setInterval + useEffect cleanup | TanStack Query refetchInterval | Handles tab visibility, component lifecycle, error backoff |
| Cross-component cache | stela:sync event bus | TanStack Query shared cache | Single cache, automatic invalidation, no event wiring |
| URL param parsing | Manual useSearchParams + type coercion | nuqs parsers | Type-safe, handles defaults, shallow updates |
| Cross-component ephemeral state | React Context (BatchSelectionProvider) | Zustand store | Selector subscriptions avoid Context re-render problem |

**Key insight:** The existing `useFetchApi` and `useInfiniteApi` are ~220 lines that poorly reimplement what TanStack Query does in 0 lines of custom code. Every behavior they have (polling, sync, race conditions, loading states) maps directly to a TanStack Query option.

## Common Pitfalls

### Pitfall 1: Cloudflare Workers + QueryClient SSR Mismatch
**What goes wrong:** Creating QueryClient at module scope causes it to be shared across requests in Cloudflare Workers (wrong), or creating it in render causes hydration mismatch.
**Why it happens:** Cloudflare Workers are stateless -- no persistent process.
**How to avoid:** Create QueryClient inside `useState(() => new QueryClient(...))`. Set `staleTime > 0` to prevent refetch on hydration.
**Warning signs:** React hydration errors in console after adding QueryClientProvider.

### Pitfall 2: Big-Bang Migration Breaking the App
**What goes wrong:** Replacing all useFetchApi calls at once introduces regressions that are hard to isolate.
**Why it happens:** Each hook has subtle behaviors (optimistic updates in useInscriptions, pagination in usePortfolio) that must be replicated.
**How to avoid:** Migrate one hook at a time. Keep useFetchApi working alongside useQuery. Start with simplest (usePairs), end with most complex (usePortfolio).
**Warning signs:** Multiple hooks broken simultaneously.

### Pitfall 3: Polling Rate Limits
**What goes wrong:** Multiple components with independent refetchIntervals create excessive API requests, hitting the 60 req/min rate limit.
**Why it happens:** TanStack Query deduplicates concurrent requests but not different polling intervals for the same data.
**How to avoid:** Use shared query keys. Set appropriate staleTime. Current intervals to preserve: pairs=15s, inscriptions=15s, orders=30s, orderbook=30s, orderDetail=5s.
**Warning signs:** 429 responses from API routes.

### Pitfall 4: useInscriptions Optimistic Updates
**What goes wrong:** The current `useInscriptions` hook has a custom optimistic update system using a `stela:optimistic-create` event. This must be preserved during migration.
**Why it happens:** New inscriptions need to appear immediately in the UI before the indexer picks them up.
**How to avoid:** Use TanStack Query's `queryClient.setQueryData()` for optimistic updates instead of the custom event. The `addOptimisticInscription` function becomes a `queryClient.setQueryData` call.
**Warning signs:** New inscriptions not appearing after creation until next poll.

### Pitfall 5: nuqs + OpenNext/Cloudflare Compatibility
**What goes wrong:** nuqs might have issues with the OpenNext adapter for Cloudflare.
**Why it happens:** nuqs is tested with Next.js 15 App Router but not specifically with OpenNext/Cloudflare Workers.
**How to avoid:** nuqs is client-side only (all pages using it have `'use client'`), so the risk is LOW. Use the `nuqs/adapters/next/app` adapter. Quick spike during implementation to verify.
**Warning signs:** URL params not updating, or SSR errors on Cloudflare.

### Pitfall 6: usePortfolio Thundering Herd
**What goes wrong:** usePortfolio fires 7 parallel requests on mount (2 paginated + 5 useFetchApi). With TanStack Query, this is fine for deduplication but could overwhelm the API on initial load.
**How to avoid:** Split into separate queries with appropriate staleTime. Use `enabled` to conditionally load secondary data. Consider whether T1 entities (collection offers, refinances, renegotiations) need to load eagerly or can be lazy-loaded per portfolio tab.
**Warning signs:** Slow initial portfolio load, rate limit hits on portfolio page.

## Code Examples

### Example 1: Migrating usePairs (simplest hook)

```typescript
// BEFORE (hooks/usePairs.ts)
import { useFetchApi } from './api'

export function usePairs() {
  const { data: raw, isLoading, error, refetch } = useFetchApi<PairsResponse>(
    '/api/pairs', undefined, 15_000
  )
  return { data: raw?.data ?? [], isLoading, error, refetch }
}

// AFTER (hooks/usePairs.ts)
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function usePairs() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pairs.all,
    queryFn: async () => {
      const res = await fetch('/api/pairs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as PairsResponse
      return json.data
    },
    refetchInterval: 15_000,
  })
  return { data: data ?? [], isLoading, error, refetch }
}
```

### Example 2: Migrating useInscriptions (with optimistic updates)

```typescript
// AFTER (hooks/useInscriptions.ts)
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useInscriptions(params?: InscriptionListParams) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inscriptions.list({
      status: params?.status, address: params?.address, page: params?.page,
    }),
    queryFn: async () => {
      const url = buildApiUrl('/api/inscriptions', { /* ... */ })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json() as ApiListResponse<InscriptionRow>).data
    },
    refetchInterval: 15_000,
  })
  return { data: data ?? [], isLoading, error, refetch }
}

// Optimistic update replaces stela:optimistic-create event
export function addOptimisticInscription(
  queryClient: QueryClient,
  inscription: InscriptionRow,
) {
  queryClient.setQueryData(
    queryKeys.inscriptions.list({ status: undefined }),
    (old: InscriptionRow[] | undefined) => [inscription, ...(old ?? [])],
  )
}
```

### Example 3: Replacing stela:sync in transaction hooks

```typescript
// BEFORE (any transaction hook)
window.dispatchEvent(new Event('stela:sync'))

// AFTER
import { useQueryClient } from '@tanstack/react-query'

function useMyTransactionHook() {
  const queryClient = useQueryClient()

  const onSuccess = () => {
    // Invalidate all queries -- TanStack Query handles deduplication
    queryClient.invalidateQueries()
  }
}
```

### Example 4: nuqs in app shell (future Phase 2 prep)

```typescript
// Just the adapter setup in Phase 1 -- actual usage comes in Phase 2
// apps/web/src/app/providers.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Wrap children with NuqsAdapter inside Providers
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom fetch hooks + useState | TanStack Query useQuery/useInfiniteQuery | TQ v5 stable (2023) | Eliminates ~220 lines of custom code, adds SWR/dedup/cache |
| Manual setInterval polling | TanStack Query refetchInterval | TQ v5 | Handles tab visibility, error backoff, component lifecycle |
| Custom event bus (stela:sync) | queryClient.invalidateQueries() | TQ v5 | Targeted invalidation, no invisible coupling |
| React Context for cross-component state | Zustand stores with selectors | Zustand v5 (2024) | Selector subscriptions prevent unnecessary re-renders |
| Manual useSearchParams | nuqs type-safe parsers | nuqs v2 (2024) | Type safety, defaults, shallow updates |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | All API calls go through TanStack Query hooks | manual-only | Grep for useFetchApi/useInfiniteApi imports -- should return 0 | N/A |
| DATA-02 | Background refresh without UI flicker | manual-only | Visual verification: navigate away and back, data shows instantly | N/A |
| DATA-03 | Auto-refresh at intervals | manual-only | Wait 30s on browse page, verify data updates without reload | N/A |

**Justification for manual-only:** These requirements are about runtime behavior (caching, polling, SWR) in a browser environment with Cloudflare Workers SSR. Unit tests would require mocking the entire fetch + QueryClient + SSR pipeline, which is more brittle than manual verification. The strongest automated check is a codebase grep confirming zero remaining useFetchApi/useInfiniteApi imports.

### Wave 0 Gaps
None -- no test infrastructure exists and the requirements are best verified manually via grep + browser testing.

## Open Questions

1. **nuqs + OpenNext compatibility**
   - What we know: nuqs works with Next.js 15 App Router. It's client-side only.
   - What's unclear: Whether the NuqsAdapter for Next.js App Router works correctly when deployed via OpenNext to Cloudflare Workers.
   - Recommendation: LOW risk since nuqs is client-only. Add the adapter and verify during implementation. If it fails, fall back to manual useSearchParams (which already works).

2. **usePortfolio decomposition strategy**
   - What we know: usePortfolio makes 7 parallel requests and does complex categorization logic.
   - What's unclear: Whether to keep it as one monolithic hook with multiple useQuery calls inside, or split into separate hooks (usePortfolioInscriptions, usePortfolioOrders, usePortfolioShares).
   - Recommendation: Split into separate hooks. The categorization logic (lending/borrowing/repaid/redeemable) stays in a composition hook that consumes the individual query hooks. This enables per-tab lazy loading in Phase 3.

3. **Contract read hooks (useInscription, useShares) also listen to stela:sync**
   - What we know: `useInscription.ts` and `useShares.ts` use `@starknet-react/core`'s `useContractRead` but also listen to `stela:sync` to trigger re-reads.
   - What's unclear: Whether `queryClient.invalidateQueries()` can trigger re-reads of starknet-react contract reads (different cache).
   - Recommendation: These hooks should call their own `refetch()` from `useContractRead` when TanStack Query queries are invalidated. Use a thin wrapper or keep a minimal event for contract read invalidation. Phase 1 should handle this explicitly.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/hooks/api.ts`, `useInfiniteApi.ts`, `usePortfolio.ts`, `usePairListings.ts`, all consumer hooks
- Codebase analysis: `apps/web/src/app/providers.tsx`, `layout.tsx`
- npm registry: @tanstack/react-query@5.91.0, nuqs@2.8.9, zustand@5.0.12

### Secondary (MEDIUM confidence)
- Prior research: `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` (project-specific, code-verified)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Query already installed, nuqs/zustand well-documented
- Architecture: HIGH - Provider pattern verified against existing codebase structure
- Migration inventory: HIGH - Complete grep of all useFetchApi/stela:sync usage
- Pitfalls: HIGH - Identified from direct code analysis of existing patterns

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries, low churn)
