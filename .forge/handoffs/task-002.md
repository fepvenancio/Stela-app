# Handoff: task-002 — Relocate borrow/components/ to components/trade/ and deduplicate ROLE_META

## What Was Done

### Files Created

| File | Description |
|------|-------------|
| `apps/web/src/components/trade/role-meta.ts` | New single source of truth for `AssetRole` type, `ROLE_META` constant, and `ROLES` array |
| `apps/web/src/components/trade/AssetRow.tsx` | Moved from `borrow/components/AssetRow.tsx`; now imports `AssetRole` and `ROLE_META` from `./role-meta` |
| `apps/web/src/components/trade/AddAssetModal.tsx` | Moved from `borrow/components/AddAssetModal.tsx`; now imports `AssetRole`, `ROLE_META`, and `ROLES` from `./role-meta` |
| `apps/web/src/components/trade/InlineBorrowForm.tsx` | Moved from `borrow/components/InlineBorrowForm.tsx`; no ROLE_META dependency, copied as-is |

### Deduplication

Both `AssetRow.tsx` and `AddAssetModal.tsx` previously defined identical `ROLE_META` objects (and the duplicate `ROLES` array in `AddAssetModal.tsx`). These have been extracted into `role-meta.ts` and are now imported by both components. The `ROLE_META` constant is now defined exactly once.

### Component Behaviour

All three components have **identical functionality** to their originals in `borrow/components/`. No logic was changed — only import paths were updated to use the shared `./role-meta` module.

### Security Audit (SECURITY.md)

- No hardcoded private keys or secrets ✓
- No `eval()` or dynamic code execution ✓
- No `dangerouslySetInnerHTML` ✓
- BigInt/u256 values rendered as strings ✓
- No API inputs (frontend-only components) ✓

## What Was NOT Done

- The original files in `apps/web/src/app/borrow/components/` were **not deleted** — that is intentional per the task scope. Deletion and import-path updates in consumers (`borrow/page.tsx`, etc.) are for subsequent tasks.
- No redirect routes (`/swap` → `/trade?mode=swap`, `/borrow` → `/trade?mode=advanced`) were created — out of scope for this task.
- No changes to `useOrderForm.ts` or `multi-match.ts` (touch map excludes these).

## Concerns & Edge Cases

- `formatTokenValue` is imported from `@/lib/format` in `InlineBorrowForm.tsx` but from `@fepvenancio/stela-sdk` in `AssetRow.tsx`. This matches the originals exactly; both paths exist in the codebase and appear intentional.
- `AssetRole` is re-exported from both `AssetRow.tsx` and `AddAssetModal.tsx` as a convenience for consumers that import the component and need the type. This avoids forcing callers to know about `role-meta.ts` directly.

## Security Items Flagged Outside Scope

None found in the files reviewed.

## Files Modified (matches touch_map.writes exactly)

- `apps/web/src/components/trade/InlineBorrowForm.tsx` ✓
- `apps/web/src/components/trade/AssetRow.tsx` ✓
- `apps/web/src/components/trade/AddAssetModal.tsx` ✓
- `apps/web/src/components/trade/role-meta.ts` ✓
