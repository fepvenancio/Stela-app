# Retrospective

## Milestone: v1.0 — UX Overhaul

**Shipped:** 2026-03-19
**Phases:** 4 | **Plans:** 9

### What Was Built
- TanStack Query activation replacing custom useFetchApi/useInfiniteApi (was installed but unused)
- nuqs URL state on Trade page for Browse→Trade state preservation and shareable links
- Zustand batch-selection store replacing React Context
- OrderBook mounted on Trade page with sorted rates
- FeeBreakdown on all signing paths
- BlendedRateSummary with debt-amount-weighted APR
- QuickLendModal with in-place SNIP-12 signing from Browse page
- Portfolio page wired with SummaryBar, action wrappers (Repay/Claim/Cancel/Liquidate), countdown timers
- Bot rate-sorted settlement with shared computeInterestRate in @stela/core
- BotRankBadge matching preview in BestTradesPanel

### What Worked
- Research-first approach correctly identified that most components already existed — this was a wiring project, not a building project
- Plan checker caught real bugs before execution (QuickLendModal navigating away, wrong blended rate computation, missing SNIP-12 cancel signature)
- Parallel plan execution in same wave saved time (Phase 2 plans ran simultaneously)
- YOLO mode with quality agents (Opus research/planning, Sonnet checking) balanced speed and quality

### What Was Inefficient
- UI-SPEC revision loops added tokens for mechanical fixes (spacing values in wrong section, typography count off by 1)
- VALIDATION.md was written before plans existed, causing identifier mismatches that required fixes later
- No CONTEXT.md for any phase — discuss-phase was always skipped, meaning the planner had to derive UX decisions from research alone

### Patterns Established
- `computeInterestRate` in @stela/core as shared rate computation for bot and frontend
- PortfolioRow wrapper pattern for conditional hook instantiation per status
- nuqs parsers in dedicated `search-params.ts` file per page
- BlendedRateSummary using weighted average from selectOrders output

### Key Lessons
- Activate what's already installed before adding new dependencies
- Plan checker pays for itself — caught 3 execution-blocking bugs across the project
- Gap-filling existing code is faster and less risky than building from scratch
- Brownfield codebase mapping before planning prevents wrong assumptions

### Cost Observations
- Model mix: Opus for research/planning, Sonnet for checking/verification
- 4 phases completed in single session
- Notable: Phase 3 (Portfolio) was the most efficient — existing components just needed wiring

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 4 |
| Plans | 9 |
| Plan checker iterations | 5 (across all phases) |
| UI-SPEC iterations | 2 (Phase 2), 2 (Phase 3) |
| Verification score | 38/38 must-haves (100%) |
