---
phase: 4
slug: bot-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework — verification via grep + build |
| **Config file** | none |
| **Quick run command** | `pnpm build` |
| **Full suite command** | `pnpm build && pnpm lint` |
| **Estimated runtime** | ~90 seconds (full monorepo build) |

---

## Sampling Rate

- **After every task commit:** Run build for affected package
- **After every plan wave:** Run full monorepo build
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | BOT-01 | grep | `grep -r "computeInterestRate\|sortByRate" packages/core/src/ -l` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | BOT-01 | grep+build | `grep -r "sortByRate\|computeInterestRate" workers/bot/src/ -l && pnpm build` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | BOT-02 | grep | `grep -r "MatchPreview\|botRank" apps/web/src/ -l` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No new dependencies. All libraries already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot settles lowest rate first | BOT-01 | Requires multiple matched offers + bot cron run | Create 3 offers with different rates, trigger bot, verify settlement order |
| Trade page shows matching preview | BOT-02 | Requires visual inspection | View Trade page with offers, verify rank badges and rate reasoning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
