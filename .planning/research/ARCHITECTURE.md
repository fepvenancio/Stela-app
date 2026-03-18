# Architecture Patterns

**Domain:** DeFi P2P Lending UX (state layers, data flow, component structure)
**Researched:** 2026-03-18

## Recommended Architecture

### State Layer Model

```
+-------------------+  Shareable, bookmarkable, survives navigation
|   URL State       |  nuqs: pair, mode, amount, duration, filters
|   (nuqs)          |  Lives in: URL search params
+-------------------+
         |
+-------------------+  Cached, deduplicated, auto-refreshing
|   Server Cache    |  TanStack Query: inscriptions, orders, portfolio,
|   (TanStack Q)    |  order book, shares, balances
+-------------------+
         |
+-------------------+  Ephemeral, session-only, no persistence
|   Client State    |  Zustand: form drafts, batch selections,
|   (Zustand)       |  UI preferences, modal state
+-------------------+
         |
+-------------------+  Managed by @starknet-react/core
|   Wallet State    |  Account, chain, connection status
|   (starknet-react)|  DO NOT duplicate or wrap
+-------------------+
```

### Component Boundaries

| Component | Responsibility | State Layer |
|-----------|---------------|-------------|
| Browse/Markets page | List pairs, link to trade with URL params | URL (nuqs) + Server (TQ) |
| Trade page | Create orders, view order book, sign | URL (nuqs) + Server (TQ) + Client (Zustand) |
| Order book panel | Display sorted orders by rate | Server (TQ) |
| Portfolio page | Show user positions across tabs | Server (TQ) + URL (tab selection) |
| Position card | Single position with actions | Server (TQ) for data, wallet for actions |
| Batch selection bar | Multi-select for batch settle | Client (Zustand) |
| Trade form | Asset inputs, duration, mode | Client (Zustand) for draft, URL (nuqs) for initial values |

### Data Flow

```
Browse Page                    Trade Page
-----------                    ----------
[Pair Card] --click-->  /trade?pair=ETH_USDC&mode=lend
                               |
                        nuqs reads URL params
                               |
                        useQuery(['orderbook', pair])
                               |
                        Order Book Display
                               |
                        User fills amount
                               |
                        Zustand: trade form store
                               |
                        Sign & Submit
                               |
                        queryClient.invalidateQueries()
                               |
                        Auto-refresh shows new state
```

## Patterns to Follow

### Pattern 1: URL-First Navigation State

**What:** All cross-page state lives in URL search params, never in global stores.

**When:** Any state that should survive page refresh, be shareable, or represent navigation intent.

**Example:**
```typescript
// Browse page: encode intent in link
<Link href={`/trade?pair=${pair}&mode=lend`}>Lend</Link>

// Trade page: read from URL
const [pair, setPair] = useQueryState('pair')
const [mode, setMode] = useQueryState('mode', parseAsStringLiteral(['lend', 'swap']))
```

### Pattern 2: Query Key Hierarchy

**What:** Structured query keys that enable targeted invalidation.

**When:** Any TanStack Query usage.

**Example:**
```typescript
// Query keys follow a hierarchy
const queryKeys = {
  inscriptions: {
    all: ['inscriptions'] as const,
    list: (filters: Filters) => ['inscriptions', 'list', filters] as const,
    detail: (id: string) => ['inscriptions', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters: Filters) => ['orders', 'list', filters] as const,
    book: (pair: string) => ['orders', 'book', pair] as const,
  },
  portfolio: {
    all: (address: string) => ['portfolio', address] as const,
  },
}

// Invalidate all inscriptions after a transaction
queryClient.invalidateQueries({ queryKey: queryKeys.inscriptions.all })

// Replace stela:sync event with single invalidation
function onTransactionConfirmed() {
  queryClient.invalidateQueries() // invalidate everything
}
```

### Pattern 3: Zustand Stores with Selectors

**What:** Small, focused stores with selector subscriptions to prevent unnecessary re-renders.

**When:** Client-only ephemeral state shared between components.

**Example:**
```typescript
// stores/trade.ts
interface TradeStore {
  draftAssets: Map<AssetRole, AssetInputValue[]>
  setAsset: (role: AssetRole, index: number, value: AssetInputValue) => void
  clearDraft: () => void
}

const useTradeStore = create<TradeStore>((set) => ({
  draftAssets: new Map(),
  setAsset: (role, index, value) => set((state) => {
    const next = new Map(state.draftAssets)
    const assets = [...(next.get(role) ?? [])]
    assets[index] = value
    next.set(role, assets)
    return { draftAssets: next }
  }),
  clearDraft: () => set({ draftAssets: new Map() }),
}))

// Component uses selector -- only re-renders when debt assets change
const debtAssets = useTradeStore((s) => s.draftAssets.get('debt') ?? [])
```

### Pattern 4: Optimistic Updates for Transactions

**What:** Update UI immediately on transaction submission, roll back on failure.

**When:** Any on-chain write (lend, repay, cancel, redeem).

**Example:**
```typescript
const mutation = useMutation({
  mutationFn: submitLendOffer,
  onMutate: async (newOffer) => {
    await queryClient.cancelQueries({ queryKey: ['orders', 'book', pair] })
    const previous = queryClient.getQueryData(['orders', 'book', pair])
    queryClient.setQueryData(['orders', 'book', pair], (old) => ({
      ...old,
      offers: [...old.offers, { ...newOffer, status: 'pending' }],
    }))
    return { previous }
  },
  onError: (err, newOffer, context) => {
    queryClient.setQueryData(['orders', 'book', pair], context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['orders', 'book', pair] })
  },
})
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Custom Event Bus for State Sync

**What:** Using `window.dispatchEvent('stela:sync')` to coordinate refetches across components.

**Why bad:** Creates invisible coupling between components. No way to target specific queries. All consumers re-fetch everything on any event.

**Instead:** Use `queryClient.invalidateQueries()` with targeted query keys. TanStack Query handles deduplication and only refetches what's actually stale.

### Anti-Pattern 2: useState for Server Data

**What:** Using `useState` + `useEffect` + `fetch` for API data (the current `useFetchApi` pattern).

**Why bad:** No caching, no deduplication, no stale-while-revalidate, no background refetch, manual race condition handling.

**Instead:** Use `useQuery` from TanStack Query. It handles all of these concerns.

### Anti-Pattern 3: Context for Frequently Changing State

**What:** Using React Context for batch selection state (current `BatchSelectionProvider`).

**Why bad:** Every context consumer re-renders on any state change, even if they only read a boolean `isSelected(id)`.

**Instead:** Use Zustand with selectors. Only components that read changed state re-render.

### Anti-Pattern 4: Duplicating State Across Layers

**What:** Storing the same data in URL params AND a Zustand store AND TanStack Query cache.

**Why bad:** State gets out of sync, bugs are invisible.

**Instead:** Each piece of state has exactly one owner. URL params are the source of truth for navigation state. TanStack Query cache is the source of truth for server data. Zustand is the source of truth for ephemeral client state.

## Scalability Considerations

| Concern | Current (10s of users) | At 1K users | At 10K users |
|---------|------------------------|-------------|--------------|
| Order book size | Fits in memory, no virtualization | May need virtualization | Needs virtualization + API pagination |
| Portfolio data | Single fetch, all positions | Paginated fetch (already implemented) | Paginated + cached with staleTime |
| API rate limits | 60 req/min per IP | Sufficient | May need CDN caching layer |
| Polling frequency | 30s fine | 30s fine | May need adaptive polling |

## Sources

- Codebase analysis of existing hooks and state patterns
- [TanStack Query docs](https://tanstack.com/query/v5/docs/framework/react/overview) -- HIGH confidence
- [Zustand patterns](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) -- MEDIUM confidence
- [nuqs documentation](https://nuqs.dev/docs/adapters) -- HIGH confidence
