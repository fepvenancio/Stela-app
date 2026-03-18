# Handoff — task-009: Update navigation — add Portfolio, clean up nav links

## What was done

- **Added Portfolio nav link** to `NAV_LINKS` in `apps/web/src/components/AppShell.tsx`, positioned between Markets and NFT.
- The link points to `/portfolio` and carries a briefcase/portfolio SVG icon consistent with the existing icon style.
- Both the desktop nav and mobile Sheet nav automatically consume `NAV_LINKS`, so **mobile nav is updated at no extra cost** — no separate mobile-only change was required.
- **Active-state for `/trade`** already works correctly for any `?mode=` param. `usePathname()` returns only the pathname (no query string), and `isActive` uses `pathname.startsWith(href)`, so `/trade?mode=lend`, `/trade?mode=swap`, etc. all highlight the Trade link.
- **Help menu and scroll buttons** were not touched.
- **No `/swap` or `/borrow` entries** were added to the nav (they were absent before and remain absent).
- **Faucet** remains sepolia-only via the existing conditional spread.

## What was NOT done (scope deliberately excluded)

- Creating or modifying `apps/web/src/app/portfolio/page.tsx` (must-not-change).
- Creating `/swap` or `/borrow` redirect routes (out of scope for this task; belongs to task unifying Trade page).
- Any changes to `/trade` page, `/markets`, or other routes.

## Files modified

| File | Change |
|------|--------|
| `apps/web/src/components/AppShell.tsx` | Added Portfolio entry to `NAV_LINKS` array |

_(Matches `touch_map.writes` exactly.)_

## Concerns / edge cases

- The `/portfolio` route must exist (page file at `apps/web/src/app/portfolio/page.tsx`) for the link to resolve. The task description lists it as a readable file implying it exists, but it was not found in the worktree at time of execution. If the page file is absent, Next.js will 404. Recommend verifying the portfolio page is deployed before this change goes live, or deploying it in the same PR.

## Security self-audit (SECURITY.md)

| Check | Status |
|-------|--------|
| No hardcoded private keys or secrets | ✅ — only SVG paths and route strings added |
| No eval() or dynamic code execution | ✅ |
| No dangerouslySetInnerHTML | ✅ |
| BigInt/u256 values not cast to Number | ✅ — no data handling in this change |

No security concerns found. No security issues observed in code outside this scope.
