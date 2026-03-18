# Handoff: task-010 — Remove duplicated constants from markets page

## What was done

- Added import of `formatDurationHuman` from `@/lib/trade-constants` in
  `apps/web/src/app/markets/page.tsx`.
- Removed the locally-defined duplicate `formatDurationHuman` function (lines 83–88
  in the original file) from the same file.
- All other logic in the markets page is untouched; functionality is fully preserved.

## What was NOT done

- `apps/web/src/lib/trade-constants.ts` was not created or modified (outside touch map).
  That file is expected to be produced by **task-001** before this task's build is
  verified end-to-end.

## Concerns / edge cases

- **Dependency on task-001:** `apps/web/src/lib/trade-constants.ts` does not exist in
  this worktree. `pnpm build` will only succeed after task-001 merges and the file is
  present. If build verification is run in isolation on this branch, it will fail with a
  missing-module error until that dependency is resolved.
- The local implementation and the shared implementation in task-001's worktree are
  byte-for-byte identical, so no behavioural change is introduced by this refactor.

## Security audit (SECURITY.md)

This change only modifies an import statement and removes a pure-function definition.
No API inputs, SQL, secrets, eval, or dangerouslySetInnerHTML are involved.
All SECURITY.md items remain compliant — nothing in scope touches those surfaces.

## Files modified

- `apps/web/src/app/markets/page.tsx` ✅ (only file in touch_map.writes)
