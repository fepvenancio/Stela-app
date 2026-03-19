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
- ✓ State preservation: Browse/Markets selections carry over to Trade page via nuqs URL params — Phase 2
- ✓ Shareable trade links with pre-filled pair, mode, and amount — Phase 2
- ✓ Quick Lend from Browse via in-place signing modal — Phase 2
- ✓ OrderBook on Trade page sorted by best rate — Phase 2
- ✓ FeeBreakdown visible on all signing paths — Phase 2
- ✓ Debt-amount-weighted blended rate preview in BestTradesPanel — Phase 2
- ✓ Portfolio page with active positions, SummaryBar, and inline actions — Phase 3
- ✓ PortfolioInscriptionRow with Repay/Claim/Cancel/Liquidate actions — Phase 3
- ✓ PortfolioOrderRow with SNIP-12 cancel signing — Phase 3
- ✓ computePortfolioSummary with total lent/borrowed aggregation — Phase 3

### Active

<!-- Current scope — these are hypotheses until shipped and validated -->

- ✓ Bot rate-sorted settlement with shared computeInterestRate in @stela/core — Phase 4
- ✓ BotRankBadge matching preview in BestTradesPanel — Phase 4
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
*Last updated: 2026-03-19 after Phase 4 (Bot Matching) — all phases complete*
