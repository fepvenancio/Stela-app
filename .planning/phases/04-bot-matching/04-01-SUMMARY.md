---
phase: 04-bot-matching
plan: 01
subsystem: bot
tags: [interest-rate, settlement, bigint, sorting]

requires:
  - phase: none
    provides: standalone utility
provides:
  - computeInterestRate shared function in @stela/core
  - Bot settlement ordering by lowest interest rate first
affects: [04-bot-matching, frontend-rate-display]

tech-stack:
  added: []
  patterns: [BigInt ratio computation for cross-token rate comparison]

key-files:
  created:
    - packages/core/src/rate.ts
  modified:
    - packages/core/src/index.ts
    - workers/bot/src/index.ts

key-decisions:
  - "Function accepts { asset_type: string; value: string }[] not StoredAsset for broader compatibility"
  - "Null rates (ERC721-only, zero-debt, unparseable) sort last in settlement queue"

patterns-established:
  - "Shared rate computation: bot and frontend use same computeInterestRate from @stela/core"

requirements-completed: [BOT-01]

duration: 2min
completed: 2026-03-19
---

# Phase 04 Plan 01: Interest Rate Sorting Summary

**Shared BigInt interest rate computation in @stela/core with bot settlement ordering by lowest rate first**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T02:46:57Z
- **Completed:** 2026-03-19T02:49:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created computeInterestRate with BigInt precision (interest/debt ratio, skips ERC721)
- Bot now settles matched orders starting from lowest interest rate (best for borrowers)
- Null-rate orders (ERC721-only or unparseable) sort last in settlement queue

## Task Commits

Each task was committed atomically:

1. **Task 1: Create computeInterestRate in @stela/core and re-export** - `cd81691` (feat)
2. **Task 2: Modify bot settleOrders to sort by interest rate ascending** - `64d6418` (feat)

## Files Created/Modified
- `packages/core/src/rate.ts` - Shared interest rate computation (BigInt ratio)
- `packages/core/src/index.ts` - Re-export computeInterestRate
- `workers/bot/src/index.ts` - Rate-sorted settlement loop

## Decisions Made
- Function accepts `{ asset_type: string; value: string }[]` (not StoredAsset) so both bot and frontend can use it without type coercion
- Null rates sort last -- ensures parseable fungible orders are prioritized

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- computeInterestRate available for frontend rate display (plan 04-02)
- Bot settlement ordering is live after next deploy

---
*Phase: 04-bot-matching*
*Completed: 2026-03-19*

## Self-Check: PASSED
