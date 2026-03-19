---
phase: 03-portfolio
verified: 2026-03-19T00:00:00Z
status: passed
score: 10/10 must-haves verified
---

# Phase 3: Portfolio Verification Report

**Phase Goal:** Users can see all their active lending and borrowing positions with summary stats and take actions directly from the portfolio
**Verified:** 2026-03-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | InscriptionListRow accepts an actionLabel prop that overrides default Lend/Swap text | VERIFIED | `actionLabel?: string` in interface at line 28; used at lines 181 and 204 with `actionLabel ?? (isSwap ? 'Swap' : 'Lend')` |
| 2 | OrderListRow accepts an actionLabel prop that overrides default Lend/Swap text | VERIFIED | `actionLabel?: string` in interface at line 21; used at lines 149 and 173 with `actionLabel ?? (isSwap ? 'Swap' : 'Lend')` |
| 3 | SummaryBar displays Total Borrowed instead of Collateral Locked | VERIFIED | `PortfolioSummary.totalBorrowed` in interface; MetricCard label "Total Borrowed" at line 68; zero occurrences of `collateralLocked` |
| 4 | computePortfolioSummary aggregates PortfolioData into PortfolioSummary | VERIFIED | Exported from `portfolio-utils.ts`; uses `Pick<PortfolioData, ...>` param; aggregates lending/borrowing via `aggregateAssets` with ACTIVE_STATUSES filter |
| 5 | Portfolio page renders SummaryBar with computed metrics above tabs | VERIFIED | `<SummaryBar summary={summary} />` at line 259 in `portfolio/page.tsx`, inside the `totalPositions > 0` branch, before `<Tabs>` |
| 6 | Each inscription row shows the correct action button based on status and user role | VERIFIED | `PortfolioInscriptionRow` dispatches Repay/Claim/Cancel Position/Liquidate based on `computedStatus` and `isBorrower`/`isCreator` flags |
| 7 | Each order row shows Cancel Order button when user is borrower of a pending order | VERIFIED | `PortfolioOrderRow` sets `canCancel = isBorrower && order.status === 'pending'`; passes `actionLabel="Cancel Order"` only when `canCancel` is true |
| 8 | Countdown timers appear on filled inscription rows showing time to maturity | VERIFIED | `signedAt={ins.signed_at ?? undefined}` passed at line 76 of `PortfolioInscriptionRow`; `InscriptionListRow` computes `maturityTimestamp` and renders `useCountdown` output |
| 9 | Clicking an action button initiates the on-chain transaction with spinner feedback | VERIFIED | All four transaction hooks (`useRepayInscription`, `useRedeemShares`, `useCancelInscription`, `useLiquidateInscription`) wired; `actionPending={isPending}` passed; `Loader2` spinner shown when `actionPending` is true |
| 10 | Order cancel signs a SNIP-12 CancelOrder typed data before sending to the API | VERIFIED | `PortfolioOrderRow` calls `getCancelOrderTypedData(order.id, CHAIN_ID)`, signs with `signTypedData`, sends `{ borrower, signature }` to DELETE endpoint |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/InscriptionListRow.tsx` | actionLabel prop on InscriptionListRowProps | VERIFIED | 4 occurrences of `actionLabel`; used in desktop and mobile action buttons |
| `apps/web/src/components/OrderListRow.tsx` | actionLabel prop on OrderListRowProps | VERIFIED | 4 occurrences of `actionLabel`; used in desktop and mobile action buttons |
| `apps/web/src/lib/portfolio-utils.ts` | computePortfolioSummary pure function | VERIFIED | Exports `computePortfolioSummary`; `PortfolioSummaryInput` Pick type used twice; 46 substantive lines |
| `apps/web/src/components/portfolio/SummaryBar.tsx` | Updated SummaryBar with totalBorrowed metric | VERIFIED | `totalBorrowed` in interface and in MetricCard render; zero `collateralLocked` occurrences |
| `apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx` | Wrapper connecting transaction hooks to InscriptionListRow | VERIFIED | All 4 transaction hooks imported and called; exports `PortfolioInscriptionRow` |
| `apps/web/src/components/portfolio/PortfolioOrderRow.tsx` | Wrapper for order cancel with SNIP-12 signature | VERIFIED | `useWalletSign`, `getCancelOrderTypedData`, `CHAIN_ID` all used; exports `PortfolioOrderRow` |
| `apps/web/src/app/portfolio/page.tsx` | Portfolio page with SummaryBar and action-wired rows | VERIFIED | SummaryBar, computePortfolioSummary, PortfolioInscriptionRow, PortfolioOrderRow all imported and used |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/lib/portfolio-utils.ts` | `apps/web/src/components/portfolio/SummaryBar.tsx` | PortfolioSummary type import | WIRED | `import type { PortfolioSummary, TokenAmount } from '@/components/portfolio/SummaryBar'` at line 2 |
| `apps/web/src/app/portfolio/page.tsx` | `apps/web/src/lib/portfolio-utils.ts` | computePortfolioSummary import | WIRED | Imported at line 9; called in useMemo at line 180 |
| `apps/web/src/app/portfolio/page.tsx` | `apps/web/src/components/portfolio/SummaryBar.tsx` | SummaryBar component render | WIRED | Imported at line 8; rendered at line 259 with computed `summary` prop |
| `apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx` | `apps/web/src/hooks/transactions.ts` | useRepayInscription, useRedeemShares, useCancelInscription, useLiquidateInscription | WIRED | All 4 hooks imported and called unconditionally (satisfies React rules) |
| `apps/web/src/components/portfolio/PortfolioOrderRow.tsx` | `apps/web/src/hooks/useWalletSign.ts` | useWalletSign for SNIP-12 cancel signature | WIRED | Imported and destructured; `signTypedData` called in `handleCancel` |
| `apps/web/src/components/portfolio/PortfolioOrderRow.tsx` | `apps/web/src/lib/offchain.ts` | getCancelOrderTypedData for cancel typed data | WIRED | Imported and called with `(order.id, CHAIN_ID)` |
| `apps/web/src/app/portfolio/page.tsx` | `apps/web/src/components/portfolio/PortfolioInscriptionRow.tsx` | replacing InscriptionList with PortfolioInscriptionRow | WIRED | 5 usages across active/history tabs; no bare `InscriptionList` component present |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PORT-01 | 03-01, 03-02 | Portfolio page displays user's active lending and borrowing positions with current status | SATISFIED | `usePortfolio` provides `lending`, `borrowing`, `repaid`, `redeemable`; all rendered via `PortfolioInscriptionRow` with status badges and countdown timers via `signedAt` passthrough |
| PORT-02 | 03-01, 03-02 | Portfolio shows summary bar with total value lent, borrowed, and overall position health | SATISFIED | `SummaryBar` renders Total Lent, Total Borrowed (token amounts), Redeemable count, Active Orders count; data flows from `computePortfolioSummary` called in `page.tsx` |
| PORT-03 | 03-02 | Each position card shows inline action buttons (repay, redeem, claim) relevant to its state | SATISFIED | `PortfolioInscriptionRow` dispatches Repay/Claim/Cancel Position/Liquidate per status+role; `PortfolioOrderRow` shows Cancel Order for pending borrower orders; spinner feedback via `isPending` on all paths |

No orphaned requirements found. All three PORT requirements are addressed by plans that explicitly declare them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/portfolio/page.tsx` | 226 | `placeholder=` attribute on Input | Info | HTML input placeholder attribute — not a code stub |
| `apps/web/src/app/portfolio/page.tsx` | 63 | `return {}` in catch block | Info | Safe JSON.parse fallback inside an IIFE — not an empty implementation |

No blocker anti-patterns found.

### Human Verification Required

#### 1. Action Button Visibility

**Test:** Connect a wallet with an active filled inscription as the borrower. Navigate to `/portfolio`.
**Expected:** The row shows a "Repay" button. Clicking it opens a confirmation dialog and then dispatches the repay transaction.
**Why human:** Cannot verify the conditional rendering (`isBorrower` derived from live wallet address vs stored `ins.borrower`) without a connected wallet and real data.

#### 2. Countdown Timer Display

**Test:** Navigate to `/portfolio` with a filled inscription where `signed_at` is set. Observe the duration column.
**Expected:** A live countdown (e.g., "14d 3h") appears below the duration. Rows near expiry show "At Risk" badge and amber/red colouring.
**Why human:** `useCountdown` is a time-dependent hook; timer rendering requires live rendering in a browser.

#### 3. SNIP-12 Cancel Flow

**Test:** Connect as a borrower with a pending order. Click "Cancel Order" in the portfolio pending tab.
**Expected:** Wallet prompt appears for signature, then order disappears from the list after the API confirms cancellation.
**Why human:** Wallet connector interaction and real API DELETE call cannot be verified statically.

#### 4. SummaryBar Token Aggregation

**Test:** Load the portfolio page with at least one active lending and one active borrowing inscription.
**Expected:** Total Lent and Total Borrowed MetricCards show token amounts with the correct symbol and formatted value.
**Why human:** Token lookup via `findTokenByAddress` and `formatTokenValue` require real data with known token addresses.

### Gaps Summary

No gaps found. All must-haves from both plans are verified at all three levels (exists, substantive, wired). All three PORT requirements are satisfied. The codebase matches the PLAN specifications.

---

_Verified: 2026-03-19T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
