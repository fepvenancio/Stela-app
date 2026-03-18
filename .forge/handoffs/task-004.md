# Handoff: task-004 — Redirect /swap and /borrow to /trade?mode=

## What was done

Both `apps/web/src/app/swap/page.tsx` and `apps/web/src/app/borrow/page.tsx` were replaced with minimal Next.js server components that call `redirect()` from `next/navigation`.

| Old URL | Redirects to |
|---------|-------------|
| `/swap` | `/trade?mode=swap` |
| `/borrow` | `/trade?mode=advanced` |

Using `redirect()` in a server component produces a **307 Temporary Redirect** at the framework/RSC level — no client-side JavaScript required and no extra round-trips. The old URLs remain functional for bookmarks/deep-links.

All duplicated form logic (constants, FAQ components, `InlineBorrowForm` usage, `useOrderForm` calls) was removed from both files, satisfying the "no duplicated form logic" acceptance criterion.

## What was NOT done

- The `/trade` page itself was not modified (outside touch map).
- No borrow/swap sub-components (`AssetRow`, `AddAssetModal`, `InlineBorrowForm`) were moved or deleted — those are in `apps/web/src/app/borrow/components/` and outside this task's write scope.
- No navigation changes were made (Task 5 of the PRP — separate task).

## Concerns / Edge Cases

- **Permanent vs temporary redirect:** `redirect()` in Next.js App Router returns a 307 (temporary) redirect by default. If SEO permanence is desired for `/swap` → `/trade?mode=swap`, pass `'permanent'` as the second argument (`redirect('/trade?mode=swap', 'permanent')`). The PRP says "old URLs continue to work via redirect" without specifying 301 vs 307, so 307 is the safer default.
- **`borrow/components/` is now orphaned at the directory level** if nothing else imports from it. Those components are still imported by other files (e.g. `trade/page.tsx` may reference them), so no deletion was attempted. A follow-up cleanup task can move them to `components/trade/` per the PRP.

## Security Audit (SECURITY.md)

- No API inputs, SQL, rate limiting, or signature verification involved.
- No hardcoded secrets, no `eval()`, no `dangerouslySetInnerHTML`.
- No `any` types used — files are pure server components with no TypeScript at all beyond the import.

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/app/swap/page.tsx` | Replaced with 4-line server redirect to `/trade?mode=swap` |
| `apps/web/src/app/borrow/page.tsx` | Replaced with 4-line server redirect to `/trade?mode=advanced` |
