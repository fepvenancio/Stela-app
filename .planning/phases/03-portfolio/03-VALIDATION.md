---
phase: 3
slug: portfolio
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

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
| 3-01-01 | 01 | 1 | PORT-01, PORT-02, PORT-03 | grep+build | `grep -r "SummaryBar\|onAction\|signedAt" apps/web/src/app/portfolio/ -l && pnpm --filter web build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure from Phase 1 covers all dependencies. Portfolio page and usePortfolio hook already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Portfolio shows active positions | PORT-01 | Requires connected wallet with positions | Connect wallet, verify positions displayed with status |
| SummaryBar shows totals | PORT-02 | Requires positions for aggregation | Verify total lent/borrowed/health metrics appear |
| Action buttons work | PORT-03 | Requires wallet signing | Click Repay/Claim on a position, verify tx initiation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
