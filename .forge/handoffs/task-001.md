# Handoff — task-001

## Task
Extract shared trade constants and utilities into `lib/trade-constants.ts`

## What was done

Created `apps/web/src/lib/trade-constants.ts` as a single source of truth for
constants and utilities that were previously duplicated across `trade/page.tsx`,
`swap/page.tsx`, `borrow/page.tsx`, and `markets/page.tsx`.

### Exports

| Name | Kind | Source of truth |
|------|------|-----------------|
| `SWAP_DEADLINE_PRESETS` | `const DeadlinePreset[]` | Extracted from `trade/page.tsx` (8 entries: 5m → 30d) |
| `LEND_DEADLINE_PRESETS` | `const DeadlinePreset[]` | Extracted from `trade/page.tsx` (5 entries: 7d → 90d) |
| `DURATION_PRESETS` | `const DurationPreset[]` | Extracted from `trade/page.tsx` + `borrow/page.tsx` (7 entries: 1d → 1y) |
| `formatDurationHuman` | `function(seconds: number): string` | Extracted from `trade/page.tsx`, `borrow/page.tsx`, `markets/page.tsx` |
| `emptyAsset` | `function(): AssetInputValue` | Extracted from `trade/page.tsx` |
| `DeadlinePreset` | interface | New — `{ label: string; seconds: number }` |
| `DurationPreset` | interface | New — `{ label: string; seconds: number }` |

The `AssetInputValue` type is imported from `@/components/AssetInput` (not
duplicated) to keep the return type correctly coupled to the component.

### Verification of value parity

All preset arrays and `formatDurationHuman` body match the source pages
character-for-character. The `emptyAsset` return value matches line 69 of
`trade/page.tsx` exactly.

### TypeScript

File is strict TypeScript with no `any`. `DeadlinePreset` and `DurationPreset`
interfaces are exported for use by consumers.

### Build / type-check

Running `npx tsc --noEmit` on the full project produces only the pre-existing
`TS2688: Cannot find type definition file for '@cloudflare/workers-types'`
error caused by the `@cloudflare/workers-types` package not being installed in
this worktree. No new errors were introduced.

## What was NOT done (deliberate scope exclusion)

- **No existing files were updated.** The task scope is limited to creating
  `trade-constants.ts`. Updating the three source pages to import from the new
  file is intentionally a follow-on task (PRP Task 1 consolidation).
- Tests were not written. The acceptance criteria does not require tests for
  this task, only that `pnpm build` succeeds. The exported logic is purely
  declarative (constants) or simple arithmetic (`formatDurationHuman`).

## Files modified

| File | Action |
|------|--------|
| `apps/web/src/lib/trade-constants.ts` | **Created** |

Exactly matches `touch_map.writes`.

## Concerns / edge cases discovered

- `swap/page.tsx` defines `DEADLINE_PRESETS` (not `SWAP_DEADLINE_PRESETS`) but
  its values are identical to `SWAP_DEADLINE_PRESETS` in `trade/page.tsx`. The
  naming alignment will be resolved when the pages are unified in PRP Task 1.
- `markets/page.tsx` defines a local `formatDurationHuman` with identical body.
  This is the fourth copy. Import consolidation should happen alongside the
  page unification task.

## Security self-audit (SECURITY.md)

This file contains no API inputs, no database access, no secrets, no
`eval()`, no `dangerouslySetInnerHTML`, and no BigInt/Number coercions on
u256 values. All relevant SECURITY.md checklist items are N/A for a
pure-constants utility module.
