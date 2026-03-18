---
phase: 1
slug: data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework currently configured |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `grep -r "useFetchApi\|useInfiniteApi" apps/web/src/ --include="*.ts" --include="*.tsx" -l` |
| **Full suite command** | `pnpm build && grep -r "useFetchApi\|useInfiniteApi" apps/web/src/ --include="*.ts" --include="*.tsx" -c` |
| **Estimated runtime** | ~5 seconds (grep), ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run quick grep to verify hook migration progress
- **After every plan wave:** Run full build to verify no type errors
- **Before `/gsd:verify-work`:** Full build must succeed + zero useFetchApi/useInfiniteApi imports
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DATA-01 | grep | `grep -r "QueryClientProvider" apps/web/src/app/providers.tsx` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DATA-01 | grep | `grep -r "NuqsAdapter" apps/web/src/app/providers.tsx` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | DATA-01 | grep | `grep -r "useFetchApi" apps/web/src/ -l \| wc -l` (expect 0) | ✅ | ⬜ pending |
| 1-02-02 | 02 | 1 | DATA-02 | build | `pnpm --filter web build` (exit 0) | ✅ | ⬜ pending |
| 1-02-03 | 02 | 1 | DATA-03 | grep | `grep -r "refetchInterval" apps/web/src/ -l \| wc -l` (expect >0) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `@tanstack/react-query` is in package.json (already installed)
- [ ] Install `nuqs` and `zustand` as new dependencies

*Existing infrastructure covers build verification. No test framework needed for this phase — verification is grep-based (zero remaining custom hook imports).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SWR: cached data shows instantly on page return | DATA-02 | Requires browser navigation timing | Navigate Browse→Trade→Browse, verify data shows without loading spinner |
| Auto-refresh without flicker | DATA-03 | Requires visual observation | Stay on Browse page 30s+, verify data updates without UI jump |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
