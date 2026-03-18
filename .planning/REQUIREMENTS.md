# Requirements: Stela UX Overhaul

**Defined:** 2026-03-18
**Core Value:** A user can go from browsing to completing a lend or swap in the fewest clicks possible, with state preserved across pages, optimal trade matching, and a working portfolio view.

## v1 Requirements

### State & Navigation

- [ ] **NAV-01**: User selections on Browse/Markets (pair, mode) persist when navigating to Trade page via URL params
- [ ] **NAV-02**: User can share a trade link with pre-filled pair, mode, and amount
- [ ] **NAV-03**: User can lend/swap directly from Browse page via quick-action without full page navigation

### Data Fetching

- [ ] **DATA-01**: All API data fetching uses TanStack Query instead of custom useFetchApi/useInfiniteApi hooks
- [ ] **DATA-02**: Data polling updates in background without UI flicker (stale-while-revalidate)
- [ ] **DATA-03**: Data auto-refreshes at appropriate intervals without manual page reload

### Trade Flow

- [ ] **TRADE-01**: Order book displays offers sorted by best interest rate first
- [ ] **TRADE-02**: Fee breakdown is clearly displayed before user signs any transaction
- [ ] **TRADE-03**: User can see aggregated match preview showing which offers will fill their order and at what blended rate

### Portfolio

- [ ] **PORT-01**: Portfolio page displays user's active lending and borrowing positions with current status
- [ ] **PORT-02**: Portfolio shows summary bar with total value lent, borrowed, and overall position health
- [ ] **PORT-03**: Each position card shows inline action buttons (repay, redeem, claim) relevant to its state

### Bot Matching

- [ ] **BOT-01**: Bot settles offers in order of lowest interest rate first, aggregating multiple until the requested amount is filled
- [ ] **BOT-02**: Frontend displays which offers the bot will match for a given order and the reasoning (rate ranking)

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
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| TRADE-01 | — | Pending |
| TRADE-02 | — | Pending |
| TRADE-03 | — | Pending |
| PORT-01 | — | Pending |
| PORT-02 | — | Pending |
| PORT-03 | — | Pending |
| BOT-01 | — | Pending |
| BOT-02 | — | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
