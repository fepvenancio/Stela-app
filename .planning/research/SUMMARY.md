# Research Summary: Stela UX Overhaul

**Domain:** DeFi P2P Lending Protocol Frontend
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

The Stela app has a fully functional backend (indexer, bot, D1, API routes) but its frontend state management is fundamentally ad-hoc. The app lists `@tanstack/react-query` as a dependency but never imports it, instead relying on two custom fetch hooks (`useFetchApi` and `useInfiniteApi`) that manually re-implement caching, polling, race condition handling, and stale data management -- all worse than the library already in `package.json`. Cross-page state (the primary UX complaint) is handled via raw `useSearchParams` with no type safety or serialization.

The fix is architectural, not cosmetic: introduce a proper state layer model. URL state via `nuqs` solves the Browse-to-Trade navigation problem. Activating the already-installed TanStack Query replaces the custom hooks with industry-standard server state management. A small Zustand store handles the remaining ephemeral client state (trade form drafts, batch selections) that currently lives in React Context with excessive re-renders.

The portfolio page has a solid data hook (`usePortfolio`) that already categorizes positions into lending/borrowing/repaid/redeemable, but the page itself renders nothing. The components for displaying individual positions (`PositionCard`, `SummaryBar`) exist but aren't wired up. This is a composition problem, not a data problem.

The order book components exist (`LendingBook`, `SwapBook`, `SplitBook`, `OrderBookRow`) but need the backend to provide rate-sorted data and the frontend to display ranked matching. The bot's matching algorithm and the display algorithm need to be aligned so users understand what will settle and why.

## Key Findings

**Stack:** Activate TanStack Query (already installed), add nuqs for URL state, add Zustand for client state. Two new deps, one activation.

**Architecture:** Three-layer state model: URL (navigation intent) -> Server Cache (API data) -> Client Store (ephemeral UI state). Wallet state already handled by starknet-react.

**Critical pitfall:** Cloudflare Workers SSR + QueryClientProvider hydration mismatch. Must create QueryClient inside useState, not at module scope.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation: State Infrastructure** - Set up nuqs, TanStack Query provider, Zustand stores
   - Addresses: Browse-to-Trade state preservation, data fetching foundation
   - Avoids: Big-bang migration pitfall (Pitfall 1) by establishing infrastructure first

2. **Migration: Data Fetching** - Replace useFetchApi/useInfiniteApi with useQuery/useInfiniteQuery
   - Addresses: Loading state improvements, auto-refresh without flicker
   - Avoids: Polling rate limit issues (Pitfall 5) by consolidating fetch logic

3. **Trade Flow: URL State + Order Book** - Wire nuqs into Browse/Trade pages, improve order book sorting
   - Addresses: State preservation across pages, order matching display
   - Avoids: Over-encoding URLs (Pitfall 2) by only encoding pair+mode+amount

4. **Portfolio: Position Display** - Wire existing PositionCard/SummaryBar into portfolio page
   - Addresses: Portfolio page showing nothing
   - Avoids: Over-fetching (Pitfall 7) by splitting queries per tab

5. **Polish: Bot Matching Display + Batch UX** - Show optimal matching preview, improve batch selection
   - Addresses: Bot matching transparency, multi-lend UX
   - Avoids: Bot/display mismatch (Pitfall 11) by sharing algorithm

**Phase ordering rationale:**
- Phase 1 must come first because all subsequent phases depend on the state infrastructure
- Phase 2 before 3-4 because the data fetching migration provides stale-while-revalidate for the features built in later phases
- Phase 3 before 4 because the trade flow is the primary stated UX problem
- Phase 5 last because it's the most complex and least urgent

**Research flags for phases:**
- Phase 1: May need deeper research on nuqs + OpenNext/Cloudflare compatibility (untested combination)
- Phase 2: Standard patterns, unlikely to need research
- Phase 3: Standard patterns
- Phase 4: Standard patterns (data and components already exist)
- Phase 5: Needs research into bot matching algorithm before building display

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core recommendations verified via official docs; TanStack Query literally already installed |
| Features | HIGH | Based on direct codebase analysis; components exist but aren't wired up |
| Architecture | HIGH | State layer model is well-established React pattern, verified against ecosystem |
| Pitfalls | HIGH | Most pitfalls identified from direct code analysis of existing anti-patterns |

## Gaps to Address

- **nuqs + Cloudflare Workers compatibility**: nuqs is verified with Next.js 15 App Router but not specifically tested with OpenNext/Cloudflare. LOW risk since it's client-side only, but worth a quick spike.
- **Bot matching algorithm details**: The bot's `selectOrders` function in `multi-match.ts` needs analysis to align frontend display with bot behavior. Not researched here because it's implementation detail, not stack decision.
- **Token price data for portfolio valuation**: SummaryBar exists but portfolio value calculation needs a price source. No oracle/price API is currently configured. This is a feature gap, not a stack gap.
