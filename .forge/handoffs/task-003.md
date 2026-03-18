# Handoff: task-003 — Unify trade page with Advanced tab

## What was done

Updated `apps/web/src/app/trade/page.tsx` to add a third **Advanced** tab alongside the existing Swap and Lend tabs.

### Summary of changes

1. **Three mode tabs** — Tab bar now renders `lend | swap | advanced` (in that order, default: `lend`).

2. **URL param `?mode=advanced`** — `TradeContent` reads the `mode` search param and supports all three values. Navigating to `/trade?mode=advanced` opens the Advanced tab directly.

3. **AdvancedForm component** — New component (`AdvancedForm`) renders the full multi-asset borrow form:
   - `InlineBorrowForm` for debt/collateral/interest token selection (imported from `@/app/borrow/components/`)
   - Terms & Duration section with preset buttons + custom duration (Days/Weeks/Months)
   - Collapsible Multi-Asset Options section with `AssetRow` table and `AddAssetModal`
   - Agreement Summary panel with `FeeBreakdown` and submit button
   - Match Detection panel with `InlineMatchList`
   - `TransactionProgressModal` / `MultiSettleProgressModal`
   - Uses `useOrderForm('lending')` + `ROLES` from `@/hooks/useOrderForm`

4. **URL pre-fill** — Both `TradeForm` (Lend/Swap modes) and `AdvancedForm` read `debtToken` and `collateralToken` from URL search params on mount and pre-populate the form. A `useRef` guard ensures the effect runs only once. `orderId` param is read but not yet acted upon (Best Trades panel not in scope for this task).

5. **No duplicate constants** — `DURATION_PRESETS`, `LEND_DEADLINE_PRESETS`, `SWAP_DEADLINE_PRESETS`, `CUSTOM_DURATION_UNITS`, and `formatDurationHuman` are defined once at the top of the file and shared by all three form modes.

6. **New imports added**:
   - `useRef` (react)
   - `Input`, `Switch` (ui components)
   - `InlineMatchList`, `FeeBreakdown` (components)
   - `formatTimestamp` (added to existing `@/lib/format` import)
   - `ROLES`, `AssetRole` type (added to existing `@/hooks/useOrderForm` import)
   - `InlineBorrowForm`, `AddAssetModal`, `AssetRow` (from `@/app/borrow/components/`)

7. **InfoSections updated** — Accepts `'advanced'` as `activeTab` type, shows a dedicated Advanced FAQ and hero text for that tab.

8. **Mobile responsive** — Advanced form uses the same responsive patterns as existing forms (`flex-col md:flex-row`, `flex-wrap`, etc.). Tab bar uses `flex-wrap` on small screens.

## What was NOT done (scope deliberately excluded)

- **`lib/trade-constants.ts` not created** — This file is in the reads list but does not exist, and only `trade/page.tsx` is in the writes list. Constants are defined locally in `trade/page.tsx` (no duplication within the file). A future task should extract them to `@/lib/trade-constants.ts` and update imports across borrow/page.tsx and swap/page.tsx.
- **Components not relocated** — `InlineBorrowForm`, `AssetRow`, `AddAssetModal` remain in `apps/web/src/app/borrow/components/`. They are imported via absolute path `@/app/borrow/components/`. Relocation to `@/components/trade/` was out of scope (not in touch map writes).
- **`orderId` deep-link** — URL param `orderId` is not yet acted upon. The Best Trades panel (Task 2 of PRP) would handle highlighting/auto-scrolling to a specific order.
- **`/borrow` and `/swap` redirects** — Not implemented (not in touch map writes).
- **URL sync on tab switch** — Clicking tabs does not push `?mode=` to the URL (consistent with existing swap/lend behavior in the original file).

## Concerns / edge cases

- **`useEffect` with empty deps** — Both `TradeForm` and `AdvancedForm` use `useEffect(() => {...}, [])` with a `useRef` guard for the URL pre-fill. This intentionally runs once on mount. ESLint react-hooks/exhaustive-deps will flag this — the `// eslint-disable-next-line` comment explains the intentional choice.
- **Unknown token addresses** — If `?debtToken=` or `?collateralToken=` is not in the token registry (`findTokenByAddress` returns null), the asset is set with the raw address and defaults to 18 decimals. The user will see an unresolved address in the token selector; they can still proceed.
- **`form.setUseCustomDuration` / `form.customDurationValue` / `form.customDurationUnit`** — These are used in `AdvancedForm` based on their presence in `borrow/page.tsx`. They are read from `useOrderForm` return value. If the hook ever removes these fields, the Advanced form will fail TypeScript strict mode checks, making the regression obvious.

## Security audit (SECURITY.md self-check)

- No hardcoded private keys or secrets — ✅
- No `eval()` or dynamic code execution — ✅
- No `dangerouslySetInnerHTML` — ✅
- BigInt/u256 values rendered as strings — ✅ (all `BigInt` passed to `formatTimestamp`, displayed via string interpolation)
- No new API routes or backend changes — ✅ (frontend only)

## Files modified

- `apps/web/src/app/trade/page.tsx` ← only file in touch_map.writes
