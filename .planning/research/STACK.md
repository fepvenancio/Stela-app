# Technology Stack

**Project:** Stela UX Overhaul
**Researched:** 2026-03-18

## Current Stack (Keep As-Is)

These are locked per project constraints. No changes needed or desired.

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 15.2.x | App Router framework | Keep |
| React | 19.x | UI layer | Keep |
| Tailwind CSS | 4.x | Styling | Keep |
| starknet.js | 6.23.x | StarkNet interactions | Keep |
| @starknet-react/core | 3.7.x | Wallet hooks | Keep |
| Cloudflare Workers/D1 | Latest | Runtime + DB | Keep |
| Zod | 4.3.x | Schema validation | Keep |
| Radix UI | 1.4.x | Primitives | Keep |
| Lucide React | 0.575.x | Icons | Keep |
| sonner | 2.x | Toast notifications | Keep |

## Recommended Additions

### 1. URL State Management: nuqs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| nuqs | ^2.5.0 | Type-safe URL search params as React state | Preserves Browse-to-Trade navigation state without new global stores |

**Confidence:** HIGH (featured at Next.js Conf 2025, used by Vercel/Sentry/Supabase, 6kB gzipped)

**Rationale:** The core UX problem is "selections made on Browse/Markets don't carry to Trade page." This is fundamentally a URL state problem, not a global state problem. nuqs provides `useState`-like API backed by URL search params, so:

- Browse page selections (pair, mode, amount) encode in the URL
- Navigating to `/trade?pair=ETH_USDC&mode=lend&amount=1000` preserves intent
- Back button works naturally
- Deep-linkable/shareable trade setups
- No global store needed -- state lives in the URL where it belongs
- Works with Next.js 15 App Router and Cloudflare Workers (no server sessions)

**What it replaces:** The ad-hoc `useSearchParams` + manual serialization currently in `trade/page.tsx`.

```typescript
// Before (current pattern)
const searchParams = useSearchParams()
const pair = searchParams.get('pair')
const mode = searchParams.get('mode') as 'lend' | 'swap' | null

// After (with nuqs)
const [pair, setPair] = useQueryState('pair')
const [mode, setMode] = useQueryState('mode', parseAsStringLiteral(['lend', 'swap']).withDefault('lend'))
```

### 2. Replace Custom Fetch Hooks: TanStack Query v5

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @tanstack/react-query | ^5.90.x | Server state management | Already a dependency but completely unused -- activate it |

**Confidence:** HIGH (already in package.json, industry standard for server state)

**Rationale:** The app has `@tanstack/react-query` as a dependency but uses it zero times. Instead, it has two custom hooks (`useFetchApi` and `useInfiniteApi`) that re-implement TanStack Query's core features poorly:

- No request deduplication (same endpoint fetched by multiple components = multiple requests)
- No stale-while-revalidate (shows loading spinner on every refetch)
- No cache sharing between components
- Manual `stela:sync` event listener in every hook (TanStack Query's `queryClient.invalidateQueries` does this)
- Manual `refreshInterval` logic (TanStack Query's `refetchInterval` is battle-tested)
- Manual race condition handling with refs (TanStack Query handles this)

Migration path: Replace `useFetchApi` calls with `useQuery`, replace `useInfiniteApi` with `useInfiniteQuery`. The `stela:sync` event handler becomes a single `queryClient.invalidateQueries()` call.

```typescript
// Before
const { data, isLoading, error, refetch } = useFetchApi<OrderBookResponse>(url, undefined, 30_000)

// After
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['orderbook', debtToken, collateralToken, duration],
  queryFn: () => fetch(url).then(r => r.json()),
  refetchInterval: 30_000,
  staleTime: 10_000,
})
```

### 3. Lightweight Client State: Zustand

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| zustand | ^5.0.0 | Client-only ephemeral state (trade form, UI preferences) | Simplest store for cross-component state that doesn't belong in URL or server cache |

**Confidence:** HIGH (3kB, zero boilerplate, dominant in React ecosystem 2025)

**Rationale:** After moving server state to TanStack Query and navigation state to nuqs, the remaining state is pure client-side ephemeral state: trade form drafts, UI panel visibility, filter preferences within a session. Zustand handles this with minimal API surface.

Use cases:
- Trade form draft state (assets selected, amounts entered) that persists across tab switches within the trade page
- Order book display preferences (depth, grouping)
- Portfolio tab selection and filter state
- Batch selection state (replace the current Context-based `BatchSelectionProvider`)

**Why not Jotai:** Jotai's atomic model is overkill here. The state pieces are small and independent. Zustand's single-store pattern is simpler for this use case and has a larger ecosystem.

**Why not Context (current pattern):** `BatchSelectionProvider` uses React Context, which triggers re-renders for all consumers on any change. Zustand's selector-based subscriptions avoid this.

### 4. List Virtualization: react-virtuoso (conditional)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-virtuoso | ^4.12.x | Virtualized order book + portfolio lists | Variable-height rows, TypeScript-native, built-in infinite scroll |

**Confidence:** MEDIUM (only needed if order book or portfolio lists exceed ~100 items regularly)

**Rationale:** The order book (`LendingBook`, `SwapBook`, `SplitBook`) and portfolio position lists may grow large enough to benefit from virtualization. react-virtuoso handles variable-height rows without pre-measurement, which matters for order book rows with different content sizes.

**When to add:** Do NOT add preemptively. Add only after the portfolio page is functional and order book is populated, if performance profiling shows rendering bottleneck with 100+ rows. The current order book may never need it if the protocol stays in early growth.

**Why not react-window:** Requires known item heights, which doesn't work with variable-content order book rows.

### 5. Charts: Recharts (conditional)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| recharts | ^2.15.x | Portfolio value charts, position history | SVG-based, React-native, good for low-density dashboards |

**Confidence:** MEDIUM (only needed if portfolio page includes historical value charts)

**Rationale:** If the portfolio page shows position value over time or interest accrual curves, Recharts is the right choice for this use case. The data density will be low (daily/hourly snapshots, not tick-level), which is Recharts' sweet spot.

**When to add:** Only if portfolio page requirements include historical charts. Simple position cards with current values don't need a charting library.

**Why not lightweight-charts:** Designed for candlestick/OHLC financial data. Stela isn't a trading exchange -- it's a lending protocol. The data is position values and interest rates, not price action.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| URL state | nuqs | Manual useSearchParams | nuqs adds type safety, serialization, and shallow updates for free |
| Server state | TanStack Query v5 | Keep custom useFetchApi | Custom hooks re-implement TQ poorly; TQ already a dependency |
| Client state | Zustand | Jotai | Jotai's atomic model adds complexity for simple form state |
| Client state | Zustand | Redux Toolkit | Massive overkill for a DeFi frontend with limited client state |
| Virtualization | react-virtuoso | react-window | react-window requires known row heights |
| Virtualization | react-virtuoso | @tanstack/virtual | react-virtuoso has better DX for list/table use cases |
| Charts | Recharts | lightweight-charts | lightweight-charts is for trading charts, not lending dashboards |
| Charts | Recharts | Chart.js | Recharts is more React-idiomatic |
| State persistence | URL params (nuqs) | localStorage | URL params are shareable, bookmarkable, SSR-compatible |

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| SWR | TanStack Query is superior and already a dependency |
| Redux/RTK | Overkill for this app's state surface area |
| Recoil | Deprecated/unmaintained by Meta |
| MobX | Wrong paradigm for React 19 |
| WebSocket client | The app polls D1 via API routes; WebSockets are incompatible with Cloudflare Workers stateless model |
| Framer Motion | Nice-to-have but not part of UX overhaul scope |
| react-table / TanStack Table | The existing tables are simple enough to not warrant a table library |

## Installation

```bash
# New additions
pnpm --filter web add nuqs zustand

# Already installed but unused -- no install needed
# @tanstack/react-query is already in package.json

# Conditional (add later if needed)
# pnpm --filter web add react-virtuoso
# pnpm --filter web add recharts
```

## Migration Notes

### TanStack Query Activation

1. Create `QueryClientProvider` in `providers.tsx` alongside `StarknetConfig`
2. Replace `useFetchApi` calls one-by-one with `useQuery` (can coexist during migration)
3. Replace `useInfiniteApi` with `useInfiniteQuery`
4. Replace `stela:sync` event listeners with `queryClient.invalidateQueries({ queryKey: ['inscriptions'] })` etc.
5. Remove custom hooks once all consumers migrated

### nuqs Setup

1. Add `NuqsAdapter` to root layout
2. Define typed parsers for trade page params (pair, mode, amount, duration)
3. Replace manual `useSearchParams` in trade page with nuqs hooks
4. Add URL param encoding to Browse page navigation links

### Zustand Migration

1. Create `stores/trade.ts` for trade form state
2. Create `stores/ui.ts` for UI preferences
3. Replace `BatchSelectionContext` with Zustand store
4. No provider wrapping needed (Zustand is provider-free)

## Architecture Fit

```
URL State (nuqs)           -- navigation intent, shareable links, page params
  |
Server State (TanStack Q)  -- API data, inscriptions, orders, portfolio
  |
Client State (Zustand)     -- form drafts, UI prefs, batch selection
  |
Wallet State (starknet-react) -- account, chain, connection (already handled)
```

This layered approach means each type of state is managed by the right tool:
- **URL state** for cross-page navigation (the main UX problem to solve)
- **Server cache** for data that comes from D1/API (deduplicated, stale-while-revalidate)
- **Client store** for ephemeral UI state (no persistence needed)
- **Wallet state** already handled by starknet-react (don't touch)

## Sources

- [nuqs official site](https://nuqs.dev) -- HIGH confidence
- [nuqs at Next.js Conf 2025](https://nextjs.org/conf/session/type-safe-url-state-in-nextjs-with-nuqs) -- HIGH confidence
- [nuqs at React Advanced 2025](https://www.infoq.com/news/2025/12/nuqs-react-advanced/) -- HIGH confidence
- [TanStack Query docs](https://tanstack.com/query/latest) -- HIGH confidence
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025) -- MEDIUM confidence
- [Zustand vs Jotai comparison](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) -- MEDIUM confidence
- [react-virtuoso](https://virtuoso.dev/) -- MEDIUM confidence
- [React chart library comparison](https://blog.logrocket.com/best-react-chart-libraries-2025/) -- MEDIUM confidence
