# Stela UX Overhaul

## What This Is

A P2P lending/inscriptions protocol frontend on StarkNet with a polished, low-friction UX. Users can browse markets, lend or swap in minimal clicks with state preserved across pages, view a full portfolio with inline actions, and see transparent bot matching logic. The app runs entirely on Cloudflare Workers with D1, uses TanStack Query for data fetching, nuqs for URL state, and Zustand for client state.

## Core Value

A user can go from browsing available inscriptions to completing a lend or swap in the fewest clicks possible, with state preserved across pages, optimal trade matching, and a working portfolio view of their positions.

## Requirements

### Validated

- ✓ On-chain inscription lifecycle (create, sign, repay, cancel, liquidate) — existing
- ✓ Off-chain order flow with SNIP-12 signatures (create order, submit offer, settle) — existing
- ✓ Apibara event indexing pipeline (DNA stream → webhook → D1) — existing
- ✓ Bot automated settlement and liquidation cron — existing
- ✓ Multi-lender support with ERC1155 share tracking — existing
- ✓ Rate limiting, signature verification, nonce validation on API routes — existing
- ✓ Wallet integration (Cartridge Controller, Argent, Braavos) — existing
- ✓ Genesis NFT fee discount system — existing
- ✓ TanStack Query data fetching with stale-while-revalidate — v1.0
- ✓ nuqs URL state management — v1.0
- ✓ Zustand client state store — v1.0
- ✓ Auto-refresh without manual reload — v1.0
- ✓ State preservation: Browse→Trade via URL params — v1.0
- ✓ Shareable trade links — v1.0
- ✓ Quick Lend from Browse via in-place signing modal — v1.0
- ✓ OrderBook on Trade page sorted by best rate — v1.0
- ✓ FeeBreakdown on all signing paths — v1.0
- ✓ Debt-amount-weighted blended rate preview — v1.0
- ✓ Portfolio with positions, SummaryBar, inline actions — v1.0
- ✓ Bot rate-sorted settlement with shared computeInterestRate — v1.0
- ✓ BotRankBadge matching preview — v1.0

### Active

(None — v1.0 complete. Define next milestone requirements via `/gsd:new-milestone`)

### Out of Scope

- UI color scheme / visual design changes — user loves current colors
- Menu structure / navigation organization — confirmed working well
- Smart contract changes — frontend + bot logic only
- New financial features (new order types, new collateral types)
- Mobile app — web-first
- WebSocket real-time updates — Cloudflare Workers stateless
- Client-side price charts — not a DEX

## Context

Shipped v1.0 UX Overhaul across 4 phases, 9 plans.
Stack: Next.js 15 on Cloudflare Workers, TanStack Query, nuqs, Zustand, starknet.js v6/v9.
Key infrastructure: `@stela/core` shared types/queries/rate computation, D1 database, Apibara indexer.
Bot now settles by lowest interest rate first using shared `computeInterestRate`.

## Constraints

- **Runtime**: Cloudflare Workers — no server-side sessions
- **Tech stack**: Next.js 15, React 19, Tailwind CSS 4, starknet.js
- **Bot environment**: Cloudflare Worker cron (2-min interval)
- **Database**: D1 (SQLite) via `@stela/core` `createD1Queries`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep existing color scheme and navigation | User confirmed satisfaction | ✓ Good |
| Activate TanStack Query (already installed) | Zero new deps, replaces custom useFetchApi | ✓ Good |
| nuqs for URL state instead of global store | Cloudflare Workers has no sessions; URL is the state carrier | ✓ Good |
| Zustand replaces React Context for batch selection | Provider-free, selector-based re-renders | ✓ Good |
| QuickLendModal signs in-place (no navigation) | Minimizes clicks; keeps user on Browse page | ✓ Good |
| computeInterestRate in @stela/core | Single source of truth for bot and frontend rate calculation | ✓ Good |
| Debt-amount-weighted blended rate | Research validated this over simple average | ✓ Good |
| PortfolioRow wrapper pattern (hooks per row) | React hook rules require wrapper components for conditional logic | ✓ Good |

---
*Last updated: 2026-03-19 after v1.0 milestone*
