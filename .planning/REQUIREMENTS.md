# Requirements: Stela UX Overhaul

**Defined:** 2026-03-18
**Core Value:** A user can go from browsing to completing a lend or swap in the fewest clicks possible, with state preserved across pages, optimal trade matching, and a working portfolio view.

## v1 Requirements

### State & Navigation

- [x] **NAV-01**: User selections on Browse/Markets (pair, mode) persist when navigating to Trade page via URL params
- [x] **NAV-02**: User can share a trade link with pre-filled pair, mode, and amount
- [x] **NAV-03**: User can lend/swap directly from Browse page via quick-action without full page navigation

### Data Fetching

- [x] **DATA-01**: All API data fetching uses TanStack Query instead of custom useFetchApi/useInfiniteApi hooks
- [x] **DATA-02**: Data polling updates in background without UI flicker (stale-while-revalidate)
- [x] **DATA-03**: Data auto-refreshes at appropriate intervals without manual page reload

### Trade Flow

- [x] **TRADE-01**: Order book displays offers sorted by best interest rate first
- [x] **TRADE-02**: Fee breakdown is clearly displayed before user signs any transaction
- [x] **TRADE-03**: User can see aggregated match preview showing which offers will fill their order and at what blended rate

### Portfolio

- [x] **PORT-01**: Portfolio page displays user's active lending and borrowing positions with current status
- [x] **PORT-02**: Portfolio shows summary bar with total value lent, borrowed, and overall position health
- [x] **PORT-03**: Each position card shows inline action buttons (repay, redeem, claim) relevant to its state

### Bot Matching

- [x] **BOT-01**: Bot settles offers in order of lowest interest rate first, aggregating multiple until the requested amount is filled
- [x] **BOT-02**: Frontend displays which offers the bot will match for a given order and the reasoning (rate ranking)

## v2 Requirements

### Trade Flow

- **TRADE-04**: Order book depth visualization with cumulative bar chart at each rate level

### Portfolio

- **PORT-04**: Portfolio P&L tracking with historical value changes
- **PORT-05**: Interest accrual real-time display on active positions

### Bot Matching

- **BOT-03**: Batch settlement optimization (group multiple settlements into fewer transactions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebSocket real-time updates | Cloudflare Workers are stateless, no WS support without Durable Objects |
| Client-side price charts | Not a DEX, no continuous price data to chart |
| Complex filtering/search UI | Low item counts don't justify it |
| Notification system | Over-engineering for current user count |
| Multi-language support | Premature optimization |
| Mobile-optimized layouts | Out of scope per project constraints |
| UI color/design changes | User confirmed satisfaction with current visual design |
| Smart contract changes | Frontend + bot logic only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 2 | Complete |
| NAV-02 | Phase 2 | Complete |
| NAV-03 | Phase 2 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| TRADE-01 | Phase 2 | Complete |
| TRADE-02 | Phase 2 | Complete |
| TRADE-03 | Phase 2 | Complete |
| PORT-01 | Phase 3 | Complete |
| PORT-02 | Phase 3 | Complete |
| PORT-03 | Phase 3 | Complete |
| BOT-01 | Phase 4 | Complete |
| BOT-02 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
