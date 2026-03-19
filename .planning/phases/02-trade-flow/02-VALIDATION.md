---
phase: 2
slug: trade-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework — verification via grep + build + manual browser |
| **Config file** | none |
| **Quick run command** | `pnpm --filter web build` |
| **Full suite command** | `pnpm --filter web build && pnpm lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run build to verify no type errors
- **After every plan wave:** Run full build + lint
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | NAV-01, NAV-02 | grep | `grep -r "useQueryState\|parseAsString" apps/web/src/app/trade/ -l` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | TRADE-01, TRADE-02 | grep | `grep -r "OrderBook\|FeeBreakdown" apps/web/src/app/trade/ -l` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 1 | TRADE-03 | grep | `grep -r "BlendedRateSummary" apps/web/src/ -l` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | NAV-03 | grep | `grep -r "QuickLendModal" apps/web/src/ -l` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] nuqs already installed (Phase 1)
- [ ] TanStack Query already active (Phase 1)
- [ ] Zustand already installed (Phase 1)

*Existing infrastructure from Phase 1 covers all dependencies.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browse pair selection carries to Trade page | NAV-01 | Requires browser navigation | Select pair on Browse, click Trade, verify pair pre-filled |
| Shared URL opens with correct state | NAV-02 | Requires URL copy + new tab | Copy trade URL, open in new tab, verify state matches |
| Quick Lend modal works from Browse | NAV-03 | Requires wallet interaction | Click Quick Lend on PairCard, verify modal opens with correct pair |
| Order book sorted by rate | TRADE-01 | Requires visual inspection | View order book, verify lowest rate appears first |
| Fee breakdown visible before signing | TRADE-02 | Requires wallet interaction | Initiate lend, verify fees shown before sign prompt |
| Aggregation preview shows blended rate | TRADE-03 | Requires multiple offers | Create multiple offers, verify blended rate preview |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
