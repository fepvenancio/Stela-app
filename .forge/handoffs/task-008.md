# Handoff: task-008 — Add deep-link Trade buttons to Markets pages

## What was done

### 1. `apps/web/src/components/PairCard.tsx`

Restructured the component to add a **Trade button** that deep-links to `/trade?debtToken=0x...&collateralToken=0x...` using the raw contract addresses (not token symbols) — ensuring unambiguous token matching on the trade page.

**Pattern used:** Invisible full-card overlay link + z-indexed Trade button.
- The outer element changed from `<Link>` to `<div>` with a `<Link className="absolute inset-0">` covering the full card area (navigates to `/markets/[pair]` — existing behaviour preserved).
- A separate `<Link href={tradeHref}>` Trade button is positioned with `z-[1]` so it sits above the invisible overlay and captures clicks independently.
- The Trade button is always visible (mobile and desktop), using compact `px-2.5 py-1.5` sizing.
- Stats section remains `hidden sm:flex` (unchanged mobile behaviour).
- No `stopPropagation` needed — overlapping links with distinct z-indices handle the split correctly.

### 2. `apps/web/src/app/markets/[pair]/page.tsx`

Changed `handleQuickLend` (the ActionWidget's "Lend at X% APR" / Fill action handler) to **navigate to the Trade page with deep-link params** instead of executing an on-chain transaction directly:

```
Before: offchain → window.location.href = `/order/${orderId}`
        onchain  → wallet approve + sign_inscription multicall (inline)

After:  both     → window.location.href = `/trade?debtToken=${debtToken}&collateralToken=${collateralToken}&orderId=${orderId}`
```

**Removed now-unused code:**
- Imports: `InscriptionClient`, `toU256` (from SDK), `RpcProvider` (from starknet), `useSendTransaction`, `useSync`, `CONTRACT_ADDRESS`, `RPC_URL`
- State: `quickLendPending` / `setQuickLendPending`
- `sendAsync` destructure from `useSendTransaction`
- `sync` destructure from `useSync`
- `walletStatus` destructure from `useAccount` (was already unused)
- `isLending={quickLendPending}` → replaced with `isLending={false}` on ActionWidget

## What was NOT done (scope excluded)

- **`/trade` page changes** — Reading `debtToken`, `collateralToken`, and `orderId` from URL search params is out of scope for this task (file is in `must_not_change`). The receiving end must be implemented separately.
- **ActionWidget button label** — The "Lend at X% APR" button text was not updated to indicate navigation (e.g., "Fill at X% APR →") because `ActionWidget.tsx` is not in the touch map.
- **`/markets` page** — No changes to the markets listing page itself; PairCard handles all needed changes.
- **Other order-row "Fill" actions** (InscriptionListRow, OrderListRow) — The individual-stelas section's row-level actions (`handleOnchainAction`, `handleOffchainAction`) were not changed. They still execute inline. Only the ActionWidget's quick-lend was in scope per the acceptance criteria.

## Concerns and edge cases

1. **`/trade` page must handle the params** — Deep links will only be useful once the Trade page reads `debtToken`, `collateralToken`, and `orderId` from search params. Until then, clicking Trade navigates correctly but form pre-fill won't work.

2. **PairCard overlay link accessibility** — The invisible overlay link uses `tabIndex={-1}` to remove it from tab order (the visible arrow is the keyboard-accessible affordance). Screen reader users will see the Trade button as the primary action. This is intentional UX — the full-card click is a mouse convenience, not the primary interaction.

3. **Browser navigation vs. Next.js router** — `handleQuickLend` uses `window.location.href` (full navigation) rather than Next.js `useRouter().push()`. This is consistent with the original offchain path and avoids the hook being called outside a component lifecycle. A minor improvement would be to use `router.push()` for a softer navigation, but that requires adding `useRouter` which is fine.

4. **No wallet-connect guard on handleQuickLend** — The original offchain path also lacked a wallet guard (it just navigated to `/order/...`). The Trade page should handle auth state. Removed the wallet check that was only relevant for the now-deleted on-chain execution path.

## Security audit (SECURITY.md)

- No API inputs, no SQL, no signatures, no secrets touched. This is a frontend-only navigation change.
- No `eval()`, no `dangerouslySetInnerHTML`, no hardcoded secrets added.
- BigInt/u256 values: not touched in this change.
- **No security concerns found** in the changed files.

## Files modified (matches touch_map.writes exactly)

- `apps/web/src/components/PairCard.tsx`
- `apps/web/src/app/markets/[pair]/page.tsx`
