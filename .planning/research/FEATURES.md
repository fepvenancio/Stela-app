# Feature Landscape

**Domain:** DeFi P2P Lending Protocol UX
**Researched:** 2026-03-18

## Table Stakes

Features users expect from a functional DeFi lending interface. Missing = product feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Browse-to-Trade state preservation | Users expect selected pair/mode to carry over when navigating | Low | URL params via nuqs solve this completely |
| Portfolio: active positions | Every DeFi app shows your open positions | Medium | Data exists in D1, needs aggregation + display |
| Portfolio: position status | Users need to see filled/partial/open/expired at a glance | Low | `enrichStatus` already exists, needs proper display |
| Order book with sorted rates | Users expect to see best rates first | Medium | API needs sorting, frontend needs ranked display |
| Clear fee display before signing | Users won't sign transactions without knowing costs | Low | FeeBreakdown component exists, needs integration everywhere |
| Transaction progress feedback | Users need to know tx is pending/confirmed/failed | Low | TransactionProgressModal exists |
| Loading states that don't flash | Stale-while-revalidate for data polling | Low | TanStack Query provides this for free |

## Differentiators

Features that improve the experience beyond baseline expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Best trade aggregation preview | Show users "bot will match these 3 offers for best rate" before they sign | High | Requires multi-match algorithm display |
| Instant settle from Browse | One-click lend directly from Browse page without navigating to Trade | Medium | Combine batch selection + instant settle |
| Shareable trade links | Share a specific pair/mode/amount setup via URL | Low | Free with nuqs URL state |
| Portfolio summary bar | Total value lent, borrowed, PnL at top of portfolio | Medium | Needs price oracle or token value estimation |
| Position card with actions | Each portfolio position shows relevant actions (repay, redeem, claim) | Medium | Components exist, need composition |
| Order book depth visualization | Bar chart showing cumulative depth at each rate level | Medium | Standard order book UX pattern |
| Auto-refresh without flicker | Data updates in background, UI doesn't jump | Low | TanStack Query staleTime + refetchInterval |

## Anti-Features

Features to explicitly NOT build in this overhaul.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| WebSocket real-time updates | Cloudflare Workers are stateless, no WS support | Polling with TanStack Query refetchInterval (30s is fine for lending) |
| Client-side price charts | Not a DEX, no continuous price data to chart | Show static APR/rate comparisons |
| Complex filtering/search UI | Low item counts don't justify it | Simple status tabs + pair filter |
| Notification system | Over-engineering for current user count | Toast on transaction events (already exists) |
| Multi-language support | Not in scope, premature optimization | English only |
| Mobile-optimized layouts | Out of scope per project constraints | Responsive existing layouts are sufficient |
| Analytics dashboard | Not part of UX overhaul | Can add later as separate feature |

## Feature Dependencies

```
URL state (nuqs setup) --> Browse-to-Trade preservation
TanStack Query setup --> Loading state improvements --> Auto-refresh
TanStack Query setup --> Portfolio data fetching --> Portfolio cards
Portfolio data fetching --> Portfolio summary bar
Order book sorting (API) --> Order book display --> Depth visualization
Batch selection (Zustand) --> Best trade aggregation preview
```

## MVP Recommendation

Prioritize (in order):
1. **nuqs + URL state** -- directly solves the stated problem (state lost between pages)
2. **TanStack Query activation** -- fixes flickering, deduplication, enables everything else
3. **Portfolio position cards** -- the portfolio page "shows nothing" per project description
4. **Order book rate sorting** -- users need to see best rates first

Defer:
- **Depth visualization**: Nice-to-have, not needed until order volume is higher
- **Portfolio summary bar**: Needs price data infrastructure that doesn't exist yet
- **Best trade aggregation preview**: Complex, depends on bot matching logic being finalized

## Sources

- Project requirements from `.planning/PROJECT.md`
- Codebase analysis of existing components and hooks
- [Morpho UX patterns](https://morpho.org/blog/introducing-morpho-aave-v3-an-improved-lending-experience/) -- MEDIUM confidence
