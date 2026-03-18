# PRP: Streamline UI — Markets, Trade, Best-Trades & Multicall UX

## Description

Overhaul the Stela frontend to create a seamless, minimal-click trading experience. Unify `/trade`, `/swap`, and `/borrow` into a single Trade page with mode tabs. Surface best available trades automatically when users select tokens. Leverage Starknet's native multicall to batch approvals + settlement into one-click transactions.

### Problem Statement

1. **Fragmented pages** — `/trade`, `/swap`, and `/borrow` are separate pages with duplicated code (constants, form logic, layout). Users must navigate between pages to find the right flow. Should be one page with mode tabs.
2. **No best-trade surfacing** — When a user selects a debt/collateral token pair on `/trade`, there's no automatic display of the best available deals. Users must go to `/markets/[pair]` separately to see the orderbook, then come back.
3. **Too many clicks to settle** — Selecting an order, reviewing, approving tokens, and settling are separate steps with multiple modals. On Starknet, approvals + settlement can be a single multicall transaction — one click after review.
4. **Markets → Trade disconnect** — `/markets` pairs link out but don't deep-link into the trade form with context preserved. Clicking a market pair should land you on `/trade` with tokens pre-filled and best trades already visible.
5. **Navigation clutter** — The nav has Trade, Markets, NFT, Faucet. The `/swap` and `/borrow` pages are not even in the nav but exist as routes. Clean this up.

### Scope

#### Task 1: Unify Trade Page — Merge `/swap` and `/borrow` into `/trade`

**Current state:** Three separate page files (`trade/page.tsx`, `swap/page.tsx`, `borrow/page.tsx`) with duplicated constants (deadline presets, duration presets, `formatDurationHuman`), similar layouts, and the same `useOrderForm` hook.

**Target:**
- `/trade` becomes the single entry point with three mode tabs: **Lend/Borrow**, **Swap**, **Advanced** (multi-asset borrow form from current `/borrow` page)
- Tab selection updates URL search param `?mode=lend|swap|advanced` (default: `lend`)
- Move the `InlineBorrowForm`, `AssetRow`, and `AddAssetModal` components from `borrow/components/` into `components/trade/` (shared)
- `/swap` and `/borrow` become redirect routes to `/trade?mode=swap` and `/trade?mode=advanced` (keep old URLs working)
- Deduplicate constants: single source for deadline presets, duration presets, `formatDurationHuman`
- The compact two-token-box form (TokenBox + DirectionArrow) stays for Lend/Borrow and Swap modes
- Advanced mode uses the full multi-asset form from current `/borrow`

#### Task 2: Best Trades Panel on `/trade`

**Current state:** Match detection exists in `useOrderForm` (it queries `/api/orders/compatible`) but results are shown as a small inline list below the form. No ranking, no "best deal" highlight.

**Target:**
- Below the trade form, add a **Best Trades** panel that appears automatically once both tokens are selected
- Query existing `/api/orders/compatible` endpoint (already returns matching orders)
- Rank and display:
  - **For lenders:** Sort by highest APR/yield, show top 5 with one-click "Fill" button
  - **For borrowers:** Sort by lowest interest cost, show top 5 with one-click "Fill" button
  - **For swaps:** Sort by best rate (most received per unit given), show top 5
- Each row shows: counterparty (truncated address), amount, APR/rate, duration, expiry, source badge (on-chain vs off-chain)
- Clicking "Fill" on a best-trade row triggers instant settlement (see Task 4)
- If no matches exist, show "No orders found — create one" with the form pre-configured
- Use the existing `computeYieldPercent` and `multi-match.ts` selection algorithm for ranking

#### Task 3: Markets → Trade Deep Linking

**Current state:** `/markets` shows pair cards. Clicking goes to `/markets/[pair]`. The pair page has an `ActionWidget` but it's a separate mini-form. No seamless flow to `/trade`.

**Target:**
- Pair cards on `/markets` get a "Trade" button that links to `/trade?debtToken=0x...&collateralToken=0x...`
- `/markets/[pair]` ActionWidget "Fill" actions link to `/trade?debtToken=...&collateralToken=...&orderId=...` to pre-select a specific order for instant fill
- `/trade` reads `debtToken`, `collateralToken`, and optional `orderId` from URL search params on mount and pre-fills the form
- When `orderId` is provided, auto-scroll to the Best Trades panel and highlight that order
- Back button from `/trade` returns to the referring markets page (standard browser history, no special handling needed)

#### Task 4: One-Click Settlement with Multicall

**Current state:** `useInstantSettle` and `useMultiSettle` already build multicall arrays (`[...approveCalls, settleCall]`). But the UX flow involves: select order → open review modal → confirm → sign → wait. Multiple modals and clicks.

**Target:**
- When user clicks "Fill" on a Best Trade row:
  1. Show a single compact **confirmation drawer** (bottom sheet on mobile, side panel on desktop) with: order summary, your cost, counterparty, fees, "Confirm" button
  2. One click on "Confirm" executes the full multicall (approvals + settlement) as a single Starknet transaction
  3. Progress shows inline in the drawer (signing → confirming → done) — no separate modal
  4. On success, drawer auto-closes after 2s, toast notification, Best Trades panel refreshes
- For batch fills (selecting multiple orders from Best Trades): same flow, uses `useMultiSettle`, single multicall
- Leverage Cartridge Controller session keys — for users with Cartridge wallet, the approve+settle multicall executes without any wallet popup (policies already configured in `connectors.ts`)
- Remove the `TransactionProgressModal` and `MultiSettleProgressModal` usage from the trade page — replaced by inline drawer progress

#### Task 5: Clean Up Navigation

**Current state:** Nav links are Trade, Markets, NFT, Faucet. Swap and Borrow pages exist but aren't in nav.

**Target:**
- Nav links: **Trade**, **Markets**, **Portfolio**, **NFT** (+ Faucet on sepolia)
- Add Portfolio to nav (page exists at `/portfolio` but isn't linked)
- `/trade` is the default landing (already is via logo link)
- Remove direct `/swap` and `/borrow` nav entries (they redirect to `/trade?mode=...`)
- Active state highlights correctly for `/trade` regardless of `?mode=` param

### Technical Constraints

- **Framework:** Next.js 15 App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS 4 with custom theme tokens (star, aurora, nebula, dust, chalk, ash, edge, surface, abyss, void)
- **State:** React hooks + TanStack Query for server state, URL search params for page state
- **Blockchain:** starknet.js v6, @starknet-react/core v3, Cartridge Controller v0.8
- **Components:** Radix UI primitives, custom components — do NOT introduce new UI libraries
- **Deploy:** Cloudflare Workers via OpenNext — no Node.js APIs, no `fs`
- **Existing hooks:** `useOrderForm`, `useInstantSettle`, `useMultiSettle`, `useBatchSelection`, `useFeePreview` — extend, don't replace
- **Existing API:** `/api/orders/compatible`, `/api/pairs`, `/api/inscriptions` — use existing endpoints, don't create new ones unless truly needed

### Acceptance Criteria

- [ ] Single `/trade` page with Lend/Borrow, Swap, and Advanced tabs
- [ ] `/swap` and `/borrow` redirect to `/trade?mode=swap` and `/trade?mode=advanced`
- [ ] Best Trades panel auto-populates when both tokens are selected
- [ ] Best trades ranked by APR (lend), interest cost (borrow), or rate (swap)
- [ ] One-click "Fill" → confirmation drawer → single multicall tx → done
- [ ] Markets pair cards link to `/trade` with tokens pre-filled
- [ ] `/markets/[pair]` order actions deep-link to `/trade` with order context
- [ ] Portfolio added to nav
- [ ] No new npm dependencies added
- [ ] Mobile responsive (375px+)
- [ ] All existing tests pass
- [ ] `pnpm build` succeeds without errors
