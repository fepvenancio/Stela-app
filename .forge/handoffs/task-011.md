# Handoff — task-011: Delete old borrow/components/ directory

**Status: PLAN_GAP — Work stopped, awaiting orchestrator re-routing**

---

## What Was Done

- Read existing `apps/web/src/app/borrow/components/` — all three files present:
  - `InlineBorrowForm.tsx`
  - `AssetRow.tsx`
  - `AddAssetModal.tsx`
- Checked for `apps/web/src/components/trade/` — **directory does not exist**
- Searched entire `apps/web/src/` tree for remaining imports of `@/app/borrow/components/*`

## What Was NOT Done

- No files deleted
- No files modified
- Build not run (would fail in current state)

## Plan Gap Identified

**The migration prerequisite has not been completed.**

This task is scoped to "delete old `borrow/components/` after migration verified." However, the migration itself has not occurred:

| Condition | Expected | Actual |
|-----------|----------|--------|
| `apps/web/src/components/trade/` exists | Yes | **No** |
| `apps/web/src/app/swap/page.tsx` imports updated | Uses `components/trade/` | **Still imports from `@/app/borrow/components/`** (lines 14–16) |

### Blocking Import

`apps/web/src/app/swap/page.tsx` lines 14–16:
```ts
import { AssetRow } from '@/app/borrow/components/AssetRow'
import { AddAssetModal } from '@/app/borrow/components/AddAssetModal'
import { InlineBorrowForm } from '@/app/borrow/components/InlineBorrowForm'
```

Deleting `borrow/components/` with this import in place will cause a **TypeScript compile error** and a **`pnpm build` failure**, violating acceptance criteria.

### The Question for the Planner

> The predecessor migration task (copy files to `components/trade/`, update all imports in `swap/page.tsx` and any other consumers) has not been completed. Should task-011 be:
>
> **Option A** — Blocked/deferred until a preceding task runs that creates `components/trade/` and updates imports in `swap/page.tsx`.
>
> **Option B** — Expanded in scope to include: (1) creating `apps/web/src/components/trade/{InlineBorrowForm,AssetRow,AddAssetModal}.tsx`, (2) updating `apps/web/src/app/swap/page.tsx` imports, and (3) then deleting `borrow/components/`. This requires updating the touch map to include `swap/page.tsx` and `components/trade/` as WRITE targets.

## Concerns / Edge Cases

- `swap/page.tsx` is the only file with remaining `borrow/components` imports — once that is updated the deletion is safe.
- No other files (`trade/page.tsx`, `borrow/page.tsx`, or anywhere else) reference the old path.
- The `components/trade/` MUST NOT CHANGE constraint in the touch map implies those files should exist and be pre-populated by a prior task — they are not.

## Security Items

None — no security-relevant code was modified or observed in scope.

## Files Modified

None. (Touch map writes were not exercised due to PLAN_GAP.)
