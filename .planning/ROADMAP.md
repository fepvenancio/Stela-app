# Roadmap: Stela UX Overhaul

## Overview

This project transforms Stela's frontend from functional-but-friction-filled to smooth and state-aware. The work starts by replacing ad-hoc data fetching and state management with proper infrastructure (TanStack Query activation, nuqs for URL state), then rebuilds the core trade flow with state preservation and order book improvements, delivers a working portfolio page, and finishes with bot matching intelligence and transparency. Four phases, each delivering a coherent user-facing capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Layer** - Replace custom fetch hooks with TanStack Query, set up nuqs URL state and Zustand client store
- [ ] **Phase 2: Trade Flow** - State-preserving navigation from Browse to Trade, sorted order book, fee display, and quick-action lending
- [ ] **Phase 3: Portfolio** - Working portfolio page with active positions, summary stats, and inline actions
- [ ] **Phase 4: Bot Matching** - Optimal rate-based settlement logic and frontend matching preview

## Phase Details

### Phase 1: Data Layer
**Goal**: All data fetching uses TanStack Query with stale-while-revalidate, and the state infrastructure (nuqs, Zustand) is wired into the app shell
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Every API call in the app goes through TanStack Query hooks (no useFetchApi/useInfiniteApi usage remains)
  2. Navigating between pages and returning shows cached data instantly, with background refresh updating without flicker
  3. Data on Browse and Trade pages auto-refreshes at regular intervals without the user reloading the page
  4. nuqs provider and Zustand stores are initialized in the app shell and available to all pages
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Infrastructure setup: TanStack Query provider, nuqs adapter, query keys, Zustand batch-selection store
- [ ] 01-02-PLAN.md — Migrate simple hooks to useQuery and replace all stela:sync dispatchers/listeners
- [ ] 01-03-PLAN.md — Migrate complex hooks (usePortfolio, usePairListings) and delete legacy fetch infrastructure

### Phase 2: Trade Flow
**Goal**: Users can browse, select, and execute a lend or swap with state preserved across pages, clear fee visibility, and ranked offers
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03, TRADE-01, TRADE-02, TRADE-03
**Success Criteria** (what must be TRUE):
  1. Selecting a pair and mode on Browse, then navigating to Trade, shows those selections pre-filled on the Trade page
  2. Copying and sharing a trade URL opens the Trade page with the correct pair, mode, and amount pre-populated
  3. User can initiate a lend or swap directly from Browse via a quick-action button without navigating to a separate page
  4. The order book displays offers sorted by lowest interest rate first, with an aggregation preview showing the blended rate for partial fills
  5. Fee breakdown (protocol fee, relayer fee, Genesis discount if applicable) is visible before the user signs any transaction
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — nuqs URL state migration on Trade page, OrderBook integration, fee visibility audit
- [ ] 02-02-PLAN.md — Blended rate preview in BestTradesPanel, QuickLendModal and Quick Lend button on PairCard

### Phase 3: Portfolio
**Goal**: Users can see all their active lending and borrowing positions with summary stats and take actions directly from the portfolio
**Depends on**: Phase 1
**Requirements**: PORT-01, PORT-02, PORT-03
**Success Criteria** (what must be TRUE):
  1. Portfolio page displays a list of the user's active positions as both borrower and lender, each showing current status (open, filled, partial, etc.)
  2. A summary bar at the top shows total value lent, total value borrowed, and overall position health
  3. Each position card has inline action buttons (repay, redeem, claim) appropriate to the position's current state, and clicking them initiates the transaction
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Bot Matching
**Goal**: The bot settles offers optimally by rate, and users can see exactly which offers will be matched and why
**Depends on**: Phase 2
**Requirements**: BOT-01, BOT-02
**Success Criteria** (what must be TRUE):
  1. When multiple offers exist for an order, the bot settles them starting from the lowest interest rate, aggregating until the requested amount is filled
  2. On the Trade page, users can see a matching preview that shows which offers the bot will select for a given order and the rate ranking logic behind it
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
Note: Phases 2 and 3 both depend on Phase 1 but not on each other. They could be worked in parallel or in either order after Phase 1. Phase 4 depends on Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer | 0/3 | Planned | - |
| 2. Trade Flow | 0/2 | Planned | - |
| 3. Portfolio | 0/0 | Not started | - |
| 4. Bot Matching | 0/0 | Not started | - |
