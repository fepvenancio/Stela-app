---
phase: 04-bot-matching
verified: 2026-03-19T03:10:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 04: Bot Matching Verification Report

**Phase Goal:** The bot settles offers optimally by rate, and users can see exactly which offers will be matched and why
**Verified:** 2026-03-19T03:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeInterestRate is exported from @stela/core and computable by both bot and frontend | VERIFIED | `packages/core/src/rate.ts` exports the function; `packages/core/src/index.ts` re-exports it; built in `dist/index.js` and `dist/rate.js` |
| 2 | Bot settles matched orders starting from lowest interest rate | VERIFIED | `workers/bot/src/index.ts` lines 187-207: `withRates.map(...)`, `.sort((a,b) => a.rate - b.rate)`, `for (const { row } of withRates)` |
| 3 | Orders with null rates (ERC721-only, cross-token) sort last | VERIFIED | Sort comparator explicitly returns 1 for `a.rate === null` and -1 for `b.rate === null` (lines 203-206) |
| 4 | Users can see which offers the bot will settle first via rank badges | VERIFIED | `BotRankBadge.tsx` renders "Bot #N" with tooltip; `BestTradesPanel.tsx` renders `{trade.botRank !== null && <BotRankBadge rank={trade.botRank} />}` |
| 5 | Rank badges show ascending order (Bot #1 = lowest rate = settled first) | VERIFIED | `rateEntries.sort((a,b) => a.rate - b.rate)` ascending sort; `botRank = rank + 1` assigns 1 to lowest rate; null rates assigned rank null |
| 6 | An info tooltip explains the bot's rate-based settlement logic | VERIFIED | Header contains `(bot-ranked)` span with title "The bot settles offers with the lowest interest rate first. Rank #1 = cheapest for borrower = settled first." (line 389); BotRankBadge title also explains priority (line 9) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/rate.ts` | Shared interest rate computation | VERIFIED | 22-line implementation; BigInt ratio math; ERC721 skip; null-on-zero-debt guard; no stubs |
| `packages/core/src/index.ts` | Re-export computeInterestRate | VERIFIED | Line 67: `export { computeInterestRate } from './rate.js'` |
| `workers/bot/src/index.ts` | Rate-sorted settlement logic | VERIFIED | Import at line 9; sort block at lines 187-207; loop updated to iterate `withRates` |
| `apps/web/src/components/trade/BotRankBadge.tsx` | Bot rank badge component | VERIFIED | Exports `BotRankBadge`; renders "Bot #N"; tooltip with settlement priority explanation |
| `apps/web/src/components/trade/BestTradesPanel.tsx` | BestTradesPanel with bot rank annotations | VERIFIED | Imports both `computeInterestRate` and `BotRankBadge`; `botRank` field on `RankedTrade`; rank computation in useMemo; conditional badge render; "(bot-ranked)" header label |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `workers/bot/src/index.ts` | `packages/core/src/rate.ts` | `import { computeInterestRate } from '@stela/core'` | WIRED | Line 9 confirmed; function called at line 194 inside `withRates.map` |
| `workers/bot/src/index.ts` | settleOrders sort | in-memory sort by rate ascending | WIRED | `withRates.sort((a, b) => ... a.rate - b.rate)` at lines 202-207; loop iterates `withRates` |
| `apps/web/src/components/trade/BestTradesPanel.tsx` | `BotRankBadge.tsx` | import and render in TradeRow | WIRED | Line 11 import; line 203 conditional render `{trade.botRank !== null && <BotRankBadge rank={trade.botRank} />}` |
| `apps/web/src/components/trade/BestTradesPanel.tsx` | `@stela/core` | `import computeInterestRate` | WIRED | Line 9 import; called inside `ranked` useMemo at lines 333-337 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BOT-01 | 04-01-PLAN.md | Bot settles offers in order of lowest interest rate first, aggregating multiple until the requested amount is filled | SATISFIED | `computeInterestRate` in `@stela/core`; bot `settleOrders` sorts by rate ascending before building calldata |
| BOT-02 | 04-02-PLAN.md | Frontend displays which offers the bot will match for a given order and the reasoning (rate ranking) | SATISFIED | `BotRankBadge` component; `BestTradesPanel` bot rank computation in lending mode; "(bot-ranked)" header tooltip; footer label |

No orphaned requirements: REQUIREMENTS.md maps BOT-01 and BOT-02 exclusively to Phase 4 and both are claimed by a plan.

### Anti-Patterns Found

None detected across all four modified files (`rate.ts`, `index.ts`, `BotRankBadge.tsx`, `BestTradesPanel.tsx`).

### Human Verification Required

#### 1. Bot rank badges visible in lending mode

**Test:** Open the Trade page in lending mode with at least two matching offers visible in BestTradesPanel. Confirm each trade row shows a "Bot #N" badge below the source badge.
**Expected:** Bot #1 appears on the row with the lowest interest rate. Bot #2 on the next-lowest, etc. Badges are absent in swap mode.
**Why human:** Badge render depends on live match data returned by `offchainMatches`/`onchainMatches` props — cannot verify without a running browser session.

#### 2. "(bot-ranked)" tooltip readable in panel header

**Test:** In lending mode, with matches visible, hover the "(bot-ranked)" label in the BestTradesPanel header.
**Expected:** A tooltip reads "The bot settles offers with the lowest interest rate first. Rank #1 = cheapest for borrower = settled first."
**Why human:** HTML `title` attribute tooltip appearance is browser-rendered UI behavior.

#### 3. Bot settlement order on live cron run

**Test:** With two or more matched orders in D1 at different interest rates, observe a bot cron run in Worker logs.
**Expected:** Log line reads "Found N matched order(s) to settle (sorted by interest rate)"; settlements proceed lowest-rate first.
**Why human:** Requires a live cron trigger with real matched orders in the deployed Worker.

### Gaps Summary

None. All must-haves verified at all three levels (exists, substantive, wired). Phase goal is achieved.

---

_Verified: 2026-03-19T03:10:00Z_
_Verifier: Claude (gsd-verifier)_
