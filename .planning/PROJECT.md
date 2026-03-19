# Stela UX Overhaul

## What This Is

A comprehensive UX overhaul of the Stela P2P lending/inscriptions protocol frontend. The app already works end-to-end (browse, create, lend, swap, settle, liquidate) but the user flows have friction: data gets lost navigating between Browse and Trade pages, the lend/swap selection could be smoother, the bot doesn't optimally select and display the best trades, and the portfolio page shows nothing. This project fixes these flows, researches how top DeFi protocols handle similar UX, and delivers the simplest possible experience for Stela's unique inscription-based model.

## Core Value

A user can go from browsing available inscriptions to completing a lend or swap in the fewest clicks possible, with state preserved across pages, optimal trade matching, and a working portfolio view of their positions.

## Requirements

### Validated

<!-- Existing capabilities confirmed from codebase -->

- ✓ On-chain inscription lifecycle (create, sign, repay, cancel, liquidate) — existing
- ✓ Off-chain order flow with SNIP-12 signatures (create order, submit offer, settle) — existing
- ✓ Apibara event indexing pipeline (DNA stream → webhook → D1) — existing
- ✓ Bot automated settlement and liquidation cron — existing
- ✓ Multi-lender support with ERC1155 share tracking — existing
- ✓ Rate limiting, signature verification, nonce validation on API routes — existing
- ✓ Wallet integration (Cartridge Controller, Argent, Braavos) — existing
- ✓ Genesis NFT fee discount system — existing
- ✓ Browse/Markets page listing inscriptions and orders — existing
- ✓ Create inscription page — existing
- ✓ Lend/Swap tab toggle on trade pages — existing
- ✓ TanStack Query data fetching with stale-while-revalidate — Phase 1
- ✓ nuqs URL state management infrastructure — Phase 1
- ✓ Zustand client state store (batch selection) — Phase 1
- ✓ Auto-refresh at appropriate intervals without manual reload — Phase 1

### Active

<!-- Current scope — these are hypotheses until shipped and validated -->

- [ ] State preservation: selections made on Browse/Markets carry over to Trade page
- [ ] Optimal trade matching: bot selects lowest-interest-rate offers first, aggregates multiple until amount filled
- [ ] Trade display: users see clearly ranked offers by best rate with aggregation preview
- [ ] Portfolio page: shows user's active positions (as borrower and lender), history, and current status
- [ ] Lend/Swap flow optimization: minimize clicks from intent to execution
- [ ] Research-driven UX: study top DeFi protocols (Aave, Morpho, dYdX, Blur Blend) to identify best patterns for Stela's model
- [ ] Bot matching display: frontend shows what the bot will match and why

### Out of Scope

- UI color scheme / visual design changes — user confirmed they love current colors
- Menu structure / navigation organization — user confirmed current organization works well
- Smart contract changes — this is frontend + bot logic only
- New financial features (new order types, new collateral types) — focus is UX of existing features
- Mobile app — web-first

## Context

- Stela uses an inscription-based P2P lending model where borrowers create inscriptions (or off-chain orders) specifying debt, interest, and collateral assets. Lenders sign offers against these.
- The bot runs every 2 minutes to settle matched orders on-chain and liquidate expired inscriptions.
- Current bot settles orders individually via `settle()` — no intelligence about picking optimal matches when multiple offers exist.
- Frontend has `batch_settle()` support via `useMultiSettle` hook for aggregate settlement with one lender signature.
- Portfolio page exists at `/portfolio/page.tsx` but shows nothing — needs investigation.
- State between pages is lost because selections on Browse don't persist to Trade navigation.
- The Stela contract repo at `../stela-contracts/` (separate repo) should be studied to understand the full on-chain mechanics.

## Constraints

- **Runtime**: Everything runs on Cloudflare Workers — no server-side sessions, state must flow via URL params, query strings, or client-side state
- **Tech stack**: Next.js 15, React 19, Tailwind CSS 4, starknet.js — no new frameworks
- **Bot environment**: Cloudflare Worker cron — no persistent process, must complete within Worker time limits
- **Database**: D1 (SQLite) — all queries through `@stela/core` `createD1Queries`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Research top DeFi protocol UX before redesigning flows | User wants the simplest approach validated against industry standards | — Pending |
| Study stela-contracts repo for optimal matching logic | Need to understand on-chain mechanics to design best bot matching | — Pending |
| Keep existing color scheme and navigation | User explicitly confirmed satisfaction with visual design and menu organization | ✓ Good |

---
*Last updated: 2026-03-19 after Phase 1 (Data Layer) completion*
