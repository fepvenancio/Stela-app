# Handoff: task-006 — SettlementDrawer

## What was done

Created `apps/web/src/components/trade/SettlementDrawer.tsx` — a single-file,
self-contained confirmation drawer for one-click settlement.

### Features implemented

**Responsive layout**
- Mobile (< `lg`): bottom sheet — `inset-x-0 bottom-0`, `max-h-[90dvh]`,
  `rounded-t-2xl`, slides in from the bottom via Tailwind
  `data-[state=open]:slide-in-from-bottom`.
- Desktop (`lg+`): right-side panel — `w-[420px]`, full viewport height,
  `rounded-l-2xl`, slides in from the right via
  `lg:data-[state=open]:slide-in-from-right`.

**Both fill modes via discriminated-union prop**
- `mode: 'single'` + `order: MatchedOrder` → delegates to `useInstantSettle`
  with a `useTransactionProgress` instance (4 steps matching the 4 `advance()`
  calls inside the hook).
- `mode: 'batch'` + `orders: SelectedOrder[]` → delegates to `useMultiSettle`,
  whose own `state.phase` drives the 5-step progress display.

**Order summary section**
- Counterparty address (formatted via `formatAddress`) or order count for batch.
- Duration extracted from `order.order_data.duration` (BigInt-safe via
  `formatDuration`).
- Order deadline formatted to locale date/time string.
- Optional pre-formatted `summary?: SettlementSummary` prop for cost, interest,
  and APR labels (parent provides these since it already has token-registry
  context; not required for the drawer to render).

**Fee preview section**
- Calls `useFeePreview(feeType)` internally.
- Shows relayer BPS, treasury BPS (struck-through if discounted), total, and
  Genesis NFT discount badge with volume tier.

**Inline progress (no separate modal)**
- Steps appear inside the drawer after Confirm is clicked.
- `StepIcon` component renders `Circle / Loader2 / CheckCircle2 / XCircle`
  matching the design language of `TransactionProgressModal`.
- Transaction hash with Voyager link appears once the tx is submitted.

**Auto-close on success**
- `useEffect` watches `isDone`; fires `handleClose()` after 2 000 ms via a ref-
  tracked `setTimeout` that is cleared on unmount/re-render.

**Guard against accidental closure**
- While `isActive`, the X button is `disabled`, `onOpenChange` is a no-op, and
  `onEscapeKeyDown` / `onInteractOutside` call `e.preventDefault()`.

**Try-Again flow**
- On error, two buttons appear: "Try Again" (calls `handleReset()` which resets
  progress state without closing) and "Close".

**Security self-audit**
- No `eval()`, no `dangerouslySetInnerHTML`.
- All bigint conversions go through `BigInt(String(…))` with a try/catch.
- No hardcoded secrets or keys.
- No `any` — TypeScript strict mode. Unknown fields from `order.order_data` are
  narrowed before use.

## What was NOT done (deliberate scope exclusion)

- **No new tests** — the task touch map lists only one write file; test files
  were not in `touch_map.writes`. Coverage is a concern for the next task/phase.
- **No `useOrderForm` integration** — the drawer is a pure UI component; wiring
  it to the Best Trades panel (Task 2 in the PRP) is a separate task.
- **No `TransactionProgressModal` removal** — the PRP mentions removing the old
  modals from the trade page. That is a separate task touching files outside
  this touch map.
- **No `/trade` page changes** — this drawer is a new component only; page
  integration is out of scope for task-006.

## Concerns / edge cases discovered

1. **`SelectedOrder` type dependency on `OnChainMatch`** — `SelectedOrder` from
   `@/lib/multi-match` transitively depends on `@/hooks/useMatchDetection`. The
   import works as a type-only import and does not add runtime coupling, but
   future refactors should keep this chain in mind.

2. **`isActive` race on unmount** — if the parent unmounts the drawer while
   settlement is running (e.g. route navigation), the `setTimeout` is cleaned up
   by the `useEffect` return, but the settle hooks may still resolve. The toasts
   from the hooks will still fire correctly; only the auto-close callback is
   muted. This is acceptable UX.

3. **`progress` object identity** — `useTransactionProgress` returns a new
   object reference on every render (fields like `open` / `steps` change). The
   `handleConfirm` callback captures `progress` by reference because it needs
   to pass the entire `TransactionProgress` interface to `settle()`. This is
   correct but means `handleConfirm` re-creates whenever `progress` changes.
   Not a correctness issue.

4. **Batch slide animation override** — Tailwind's `lg:data-[state=open]:slide-in-from-right`
   and `lg:data-[state=closed]:slide-out-to-right` rely on the Tailwind
   `tailwindcss-animate` plugin utilities. The existing project uses these in
   the dialog component, so they are available. The explicit
   `lg:data-[state=closed]:slide-out-to-bottom-0` zeroing prevents the mobile
   slide-from-bottom from leaking into desktop at the `lg` breakpoint.

5. **No `Dialog.Description`** — Radix accessibility lint may warn about missing
   `DialogDescription`. The title is always rendered (`DialogPrimitive.Title`);
   if a description is required by the project's a11y rules, a visually-hidden
   `DialogPrimitive.Description` should be added.

## Security items flagged in code outside scope

None found in the files read.

## Files modified

| Path | Action |
|------|--------|
| `apps/web/src/components/trade/SettlementDrawer.tsx` | Created |

Matches `touch_map.writes` exactly.
