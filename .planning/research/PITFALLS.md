# Domain Pitfalls

**Domain:** DeFi P2P Lending UX Overhaul
**Researched:** 2026-03-18

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Big-Bang Migration of Data Fetching

**What goes wrong:** Attempting to replace all `useFetchApi` calls with TanStack Query in a single phase breaks the entire app if any edge case is missed.
**Why it happens:** `useFetchApi` has custom behaviors (stela:sync listener, race condition guards, refresh intervals) that must be replicated exactly.
**Consequences:** Broken pages, stale data, missing updates.
**Prevention:** Migrate one hook at a time. Keep `useFetchApi` working alongside `useQuery` during transition. Start with the simplest consumer (e.g., `useOrderBook`), verify, then move to the next.
**Detection:** Pages that show stale data or stop refreshing after migration.

### Pitfall 2: URL State Encoding Breaking Navigation

**What goes wrong:** Encoding complex state (asset arrays, multi-asset configurations) in URL params creates unreadable/breakable URLs.
**Why it happens:** Over-encoding -- trying to put everything in the URL instead of only navigation intent.
**Consequences:** URLs become fragile, browser URL bars overflow, copy-paste breaks, server-side rendering issues.
**Prevention:** Only encode identification state in URL: pair ID, mode (lend/swap), maybe amount. Complex form state (multiple assets, custom durations) lives in Zustand. The URL captures "where am I and what's my intent," not "every form field value."
**Detection:** URLs longer than ~200 characters, or URLs containing JSON-encoded data.

### Pitfall 3: Cloudflare Workers + QueryClientProvider SSR Mismatch

**What goes wrong:** TanStack Query's `QueryClientProvider` creates a new `QueryClient` on every server render in Cloudflare Workers, causing hydration mismatches.
**Why it happens:** Cloudflare Workers are stateless -- there's no persistent process. If `QueryClient` is created at module scope, it's shared across requests (wrong). If created in render, it mismatches between server and client.
**Consequences:** React hydration errors, blank pages, console warnings.
**Prevention:** Create `QueryClient` inside a `useState` or `useRef` in the provider component (standard Next.js pattern). Never create at module scope. The `staleTime` should be > 0 to prevent unnecessary refetches on hydration.
**Detection:** Console warnings about hydration mismatches after adding QueryClientProvider.

```typescript
// Correct pattern for Next.js + Cloudflare
function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000, // prevent refetch on hydration
      },
    },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

## Moderate Pitfalls

### Pitfall 4: Zustand Store Hydration with SSR

**What goes wrong:** Zustand stores with initial values cause hydration mismatch when server renders differ from client.
**Prevention:** Use Zustand only for client-side state that doesn't affect initial render. All stores should have empty/default initial state. Populate on mount, not on create. Alternatively, use the `skipHydration` option.

### Pitfall 5: TanStack Query Polling Draining Rate Limits

**What goes wrong:** Multiple components polling the same endpoint at different intervals create excessive API requests, hitting the 60 req/min rate limit.
**Prevention:** Use shared query keys so TanStack Query deduplicates requests. Set `staleTime` to prevent refetch when data is fresh. Use `refetchInterval` at the query level, not in multiple components. The order book query currently refreshes every 30s -- this is fine, but ensure portfolio + inscriptions + orders don't each poll independently at 10s.
**Detection:** 429 responses from API routes; rate limiter kicking in during normal use.

### Pitfall 6: nuqs Shallow Updates Breaking Server Components

**What goes wrong:** nuqs defaults to shallow updates (client-only, no server re-render). If any server component depends on search params, it won't update.
**Prevention:** The trade page is a client component (`'use client'`), so shallow updates are correct. But if any API route or server component reads search params, use `shallow: false` for those specific state changes. Audit which pages have server components that read params.
**Detection:** Server-rendered content not updating when URL params change.

### Pitfall 7: Portfolio Hook Over-Fetching

**What goes wrong:** The current `usePortfolio` hook fetches inscriptions (200/page), orders (200/page), shares, collection offers, refinances, and renegotiations in parallel. With TanStack Query, this could cause a thundering herd on mount.
**Prevention:** Split the portfolio query into separate queries per data type. Use `enabled` to load secondary data only after the primary query completes. Consider whether all data types need to load on initial render or can load lazily per tab.

### Pitfall 8: Batch Selection State Lost on Page Refresh

**What goes wrong:** Moving batch selection from Context to Zustand means the selection is client-only state. If the user refreshes, selections are lost.
**Prevention:** This is acceptable behavior. Batch selections are ephemeral by nature. Do NOT try to persist them in URL or localStorage. If users complain, add a small info tooltip explaining selections are session-only.

## Minor Pitfalls

### Pitfall 9: nuqs Type Parser Gotchas

**What goes wrong:** Custom nuqs parsers for StarkNet addresses fail on malformed input, crashing the page.
**Prevention:** Always use `.withDefault()` and handle parse errors gracefully. Test with garbage URL params.

### Pitfall 10: TanStack Query Cache Bloat

**What goes wrong:** Never-invalidated queries accumulate in cache, consuming memory.
**Prevention:** Set `gcTime` (garbage collection time) to a reasonable value (5 minutes). Default is fine for most cases.

### Pitfall 11: Order Book Display Mismatch with Bot Matching

**What goes wrong:** Frontend shows orders sorted by "best rate" but the bot uses a different matching algorithm, so what the user sees as "best" isn't what gets settled.
**Prevention:** The bot's matching logic and the frontend's display logic must use the same sorting criteria. Document the algorithm in one place and reference it from both.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| TanStack Query setup | Hydration mismatch in CF Workers (Pitfall 3) | Use useState for QueryClient creation |
| nuqs integration | Over-encoding complex state in URL (Pitfall 2) | Only encode pair + mode + amount |
| Portfolio rebuild | Over-fetching on mount (Pitfall 7) | Split into per-tab queries with `enabled` |
| Order book display | Mismatch with bot logic (Pitfall 11) | Share sorting algorithm between frontend and bot |
| Data fetching migration | Big-bang replacement breaking app (Pitfall 1) | Migrate one hook at a time |
| Zustand stores | SSR hydration issues (Pitfall 4) | Only use for client-side ephemeral state |

## Sources

- Direct codebase analysis of `useFetchApi`, `useInfiniteApi`, `usePortfolio`, `useBatchSelection`
- [TanStack Query SSR docs](https://tanstack.com/query/v5/docs/framework/react/guides/ssr) -- HIGH confidence
- [nuqs adapters docs](https://nuqs.dev/docs/adapters) -- HIGH confidence
- [Zustand SSR patterns](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) -- MEDIUM confidence
