# PRP: Markets/Trade Integration & Bot Best-Trades Feature

## Description

Validate, improve, and tighten the integration between `/markets` and `/trade` pages, and upgrade the bot to surface best trade options when tokens are selected.

### Problem Statement

1. **Markets → Trade flow** needs validation: pair selection on `/markets` should seamlessly carry context to `/trade` with pre-filled tokens, and `/markets/[pair]` orderbook should link directly to actionable trades.
2. **UI consistency** between markets and trade pages — shared components for token display, APR formatting, and order cards should be unified.
3. **Bot intelligence** — when a user selects a token pair on `/trade`, the system should immediately show the best available trades (highest APR for lenders, lowest cost for borrowers) from both on-chain inscriptions and off-chain orders.

### Scope

#### Task 1: Markets/Trade Navigation & Data Flow
- Ensure `/markets` pair cards link to `/trade` with query params (`?debtToken=0x...&collateralToken=0x...`)
- Ensure `/markets/[pair]` "Quick Lend" and order actions navigate to `/trade` with the correct tokens and order pre-selected
- Validate that URL params on `/trade` auto-populate the token selectors
- Ensure back-navigation from `/trade` to `/markets` preserves filter/sort state

#### Task 2: UI Consistency & Shared Components
- Extract shared `OrderCard` component used by both `/markets/[pair]` orderbook and `/trade` compatible orders list
- Unify APR/yield display formatting across markets and trade (same calculation, same decimal places, same label)
- Ensure `PairCard` stats (volume, active count) match the data shown in `/markets/[pair]` detail view
- Responsive layout audit: both pages must work on mobile (375px+)

#### Task 3: Best Trades API Endpoint
- Create `GET /api/trades/best?debtToken=X&collateralToken=Y&side=borrow|lend` endpoint
- For lenders: return top 5 orders by APR (highest yield first)
- For borrowers: return top 5 orders by lowest interest rate
- Include both on-chain inscriptions and off-chain orders in results
- Return computed APR, formatted amounts, duration, and deadline for each
- Cache results for 30s to avoid hammering D1

#### Task 4: Trade Page Best-Trades Panel
- When user selects both debt and collateral tokens on `/trade`, immediately query `/api/trades/best`
- Display a "Best Available" panel showing top trades for both borrow and lend sides
- Each trade card shows: APR, amounts, duration, counterparty (truncated address), and a one-click "Accept" button
- Panel updates reactively when tokens change
- Loading skeleton while fetching
- Empty state: "No trades available for this pair"

#### Task 5: Bot Settlement Priority
- Update `workers/bot` to settle highest-APR orders first (not FIFO)
- Add sorting to `getMatchedOrdersFull()` query: ORDER BY computed APR DESC
- Log which orders are settled and their APR in the bot output

## Acceptance Criteria
- Clicking any pair on `/markets` navigates to `/trade` with tokens pre-filled
- `/markets/[pair]` actions navigate to `/trade` with order context
- APR is calculated identically on markets and trade pages
- `GET /api/trades/best` returns top 5 trades sorted by APR
- Selecting tokens on `/trade` shows best trades panel within 500ms
- Best trades panel shows APR, amounts, duration for each trade
- One-click accept on best trade triggers signing flow
- Bot settles highest-APR matches first
- All pages responsive at 375px width
- No `any` types introduced
- All new API inputs validated with Zod
- Rate limiting applied to new endpoint
