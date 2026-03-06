# Frontend Documentation

## Overview

The frontend is a Next.js 15 application using the App Router, deployed to Cloudflare Workers via `@opennextjs/cloudflare`. It uses React 19, Tailwind CSS 4, and integrates with StarkNet wallets through `@starknet-react/core`.

Design philosophy: the frontend is a **pure rendering layer**. All protocol logic (status computation, calldata building, typed data construction, asset hashing) is delegated to `@fepvenancio/stela-sdk`. The frontend focuses on data fetching, display, and wallet interaction.

---

## Pages and Routing

| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page with hero section, philosophy cards, lending ritual walkthrough, and CTA |
| `/browse` | `src/app/browse/page.tsx` | Browse all inscriptions with status filters (open/partial/filled/expired/all), search, sort, batch selection, and off-chain orders section |
| `/create` | `src/app/create/page.tsx` | Create a new inscription order via off-chain SNIP-12 signing. Form for debt/interest/collateral assets, duration, deadline, multi-lender toggle. ROI preview. TransactionProgressModal with 3 steps. |
| `/inscription/[id]` | `src/app/inscription/[id]/page.tsx` | Inscription detail page. Shows yield, duration, borrower/lender info, assets table, timeline. Sidebar with context-aware action buttons (sign, repay, cancel, liquidate, redeem). |
| `/order/[id]` | `src/app/order/[id]/page.tsx` | Off-chain order detail page. Shows order data, assets, offers. Lenders can sign offers; borrowers can cancel. TransactionProgressModal for settlement. |
| `/portfolio` | `src/app/portfolio/page.tsx` | Dashboard with tabs for Orders/Lending/Borrowing/Redeemable positions. Summary bar with aggregate metrics. |
| `/faucet` | `src/app/faucet/page.tsx` | Mint mock tokens (mUSDC, mWETH, mDAI, StelaNFT) for Sepolia testing. |
| `/docs` | `src/app/docs/page.tsx` | In-app protocol documentation page with terminology, lifecycle, status flow diagram, mechanics, and SDK info. |

### API Routes

All API routes query D1 directly via the Cloudflare Worker binding. They use the shared `getD1()` helper from `src/lib/api.ts` which calls `getCloudflareContext()` from `@opennextjs/cloudflare`.

| Route | Method | Description |
|---|---|---|
| `/api/inscriptions` | GET | List inscriptions with optional `status`, `address`, `page`, `limit` filters. Returns inscriptions with attached assets. |
| `/api/inscriptions/[id]` | GET | Single inscription detail with assets. |
| `/api/inscriptions/[id]/locker` | GET | Locker TBA address for an inscription. |
| `/api/inscriptions/[id]/events` | GET | Event history for an inscription. |
| `/api/lockers/[address]` | GET | All lockers created by a given address. |
| `/api/shares/[address]` | GET | ERC1155 share balances for an address across all inscriptions. |
| `/api/treasury/[address]` | GET | Aggregated locked collateral assets for an address, grouped by token. |
| `/api/orders` | GET | List off-chain orders with `status`, `address` filters. |
| `/api/orders` | POST | Create a new off-chain order (borrower signature + order data). Server-side SNIP-12 signature verification and on-chain nonce validation. |
| `/api/orders/[id]` | GET | Single order detail with attached offers. |
| `/api/orders/[id]` | DELETE | Cancel a pending order (borrower only, requires signed CancelOrder typed data). |
| `/api/orders/[id]/offer` | POST | Submit a lender offer against an order. |
| `/api/sync` | POST | Immediate sync: waits for a tx receipt, parses Stela events, and writes to D1. |
| `/api/health` | GET | D1 connectivity check. |

### API Security

All API routes include:

- **Rate limiting** via sliding-window in-memory rate limiter (`src/lib/rate-limit.ts`):
  - IP-based: 60 req/min for GET, 10 req/min for POST/DELETE
  - Address-based: 10 req/min per StarkNet address for write operations
  - Max request body size: 50KB (returns 413 if exceeded)
  - IP resolved from `cf-connecting-ip` or `x-forwarded-for` headers
- **CORS** headers for `stela-dapp.xyz` and `www.stela-dapp.xyz` (reflected origin).
- **Zod validation** of request bodies (`src/lib/validation.ts`):
  - `createOrderSchema` -- validates order creation (felt252 format, asset arrays, addresses, signatures)
  - `createOfferSchema` -- validates lender offers (BPS range 1-10000, signature, nonce)
  - `cancelOrderSchema` -- validates cancellation (borrower address, signature)
  - Signature inputs accept array `[r, s]`, JSON string, or `{r, s}` object format
- **Signature verification** (`src/lib/verify-signature.ts`):
  - Reconstructs SNIP-12 typed data server-side and computes the message hash
  - Calls `is_valid_signature(hash, signature)` on the signer's account contract via raw `starknet_call` RPC
  - Returns the `'VALID'` shortstring (`0x56414c4944`) on success
  - Works in Cloudflare Worker environment using only `fetch()` (no starknet.js Account needed)
- **Nonce verification** (`src/lib/verify-nonce.ts`):
  - Verifies the submitted nonce matches the current on-chain nonce (equality check, OZ `use_checked_nonce`)
  - Prevents orders signed with consumed nonces from being stored
  - Fails open on RPC errors to avoid blocking valid requests
- **Structured error handling** (`src/lib/errors.ts`):
  - `AppError` base class with `statusCode` and `code` fields
  - `NotFoundError` (404), `UnauthorizedError` (401), `ValidationError` (400), `RateLimitError` (429)

---

## Key Components

### Layout and Shell

- **`AppShell`** (`src/components/AppShell.tsx`) -- Persistent sidebar navigation (desktop) with Sheet-based mobile drawer. Contains the STELA logo, nav links (Home, Stelas, Inscribe, Portfolio, Faucet, Docs), external link (Protocol on GitHub), and the WalletButton in the header.
- **`Providers`** (`src/app/providers.tsx`) -- Wraps the app with `StarknetConfig` from `@starknet-react/core`. Configures chain (sepolia/mainnet based on `NEXT_PUBLIC_NETWORK`), JSON RPC provider, wallet connectors (Argent, Braavos), and auto-connect.
- **`ErrorBoundary`** (`src/components/ErrorBoundary.tsx`) -- React error boundary for graceful error display.
- **`NetworkMismatchBanner`** (`src/components/NetworkMismatchBanner.tsx`) -- Warning banner shown when the connected wallet is on the wrong network.

### Wallet

- **`WalletButton`** (`src/components/WalletButton.tsx`) -- Connect/disconnect button with network indicator (Sepolia vs Mainnet). Shows truncated address when connected with a green pulse dot.
- **`Web3ActionWrapper`** (`src/components/Web3ActionWrapper.tsx`) -- Conditionally renders children only when a wallet is connected, showing a connect prompt otherwise.

### Transaction Progress

- **`TransactionProgressModal`** (`src/components/TransactionProgressModal.tsx`) -- Step-by-step modal showing transaction progress. Each step has an icon reflecting its status:
  - `idle`: grey `Circle`
  - `active`: spinning gold `Loader2`
  - `success`: green `CheckCircle2` (dimmed to 60% opacity)
  - `error`: red `XCircle` with error message

  When a `txHash` is present, a footer panel shows the truncated hash with a "Voyager" link to `https://sepolia.voyager.online/tx/{txHash}`. The modal cannot be closed until all steps complete or an error occurs. The close button text changes to "Done" on success and "Close" on error.

  Used by the `/create` page (3 steps: sign order, submit to API, confirmation) and the `/order/[id]` page (3 steps: approve & settle, confirming on-chain, saving offer).

### Inscription Display

- **`InscriptionListRow`** (`src/components/InscriptionListRow.tsx`) -- Compact row for browse/portfolio lists. Desktop: 12-column grid with status badge, debt/interest/collateral asset badges, duration. Mobile: stacked card layout. Optional selection checkbox for batch operations.
- **`OrderListRow`** (`src/components/OrderListRow.tsx`) -- Row for off-chain orders in the browse page, similar layout with "off-chain" label.
- **`InscriptionActions`** (`src/components/InscriptionActions.tsx`) -- Context-aware action panel for inscription detail pages. Renders different UI based on status and user role:
  - **Open/Partial + non-owner:** Sign & Lend form (single-lender: 100% button; multi-lender: amount input with auto BPS calculation)
  - **Open + owner:** Cancel button
  - **Filled + borrower:** Repay button
  - **Expired + signed:** Liquidate button (with confirmation dialog)
  - **Repaid/Liquidated + shares > 0:** Redeem/Claim button
  - **Otherwise:** "Vault Locked" status display

### Asset Components

- **`AssetInput`** (`src/components/AssetInput.tsx`) -- Form input for selecting an asset (address, type, amount, token ID) with token selector modal and wallet balance display.
- **`AssetBadge`** (`src/components/AssetBadge.tsx`) -- Compact badge showing token avatar, symbol, and formatted value.
- **`TokenAvatar`** / **`TokenAvatarByAddress`** (`src/components/TokenAvatar.tsx`) -- Token logo image with fallback initials.
- **`TokenSelectorModal`** (`src/components/TokenSelectorModal.tsx`) -- Modal for selecting known tokens from the registry.

### Browse Controls

- **`BrowseControls`** (`src/components/BrowseControls.tsx`) -- Search input and sort dropdown (newest, duration, debt desc/asc, APY).
- **`SelectionActionBar`** (`src/components/SelectionActionBar.tsx`) -- Floating bar that appears when inscriptions are selected for batch lending.
- **`LendReviewModal`** (`src/components/LendReviewModal.tsx`) -- Modal to review and confirm batch lending selections before signing.

### Portfolio

- **`SummaryBar`** (`src/components/portfolio/SummaryBar.tsx`) -- Grid of summary cards (total lent, collateral locked, redeemable count, active count).
- **`PositionCard`** / **`PositionCardSkeleton`** -- Individual position card and loading skeleton.

### Shared UI

- **`ConfirmDialog`** (`src/components/ConfirmDialog.tsx`) -- Reusable confirmation dialog with customizable trigger, title, description, and confirm action.
- **`CopyButton`** (`src/components/CopyButton.tsx`) -- Click-to-copy button for addresses and IDs.
- **`AddressDisplay`** (`src/components/AddressDisplay.tsx`) -- Truncated address display component.
- **UI primitives** in `src/components/ui/` -- Button, Badge, Card, Dialog, Input, Label, Select, Separator, Sheet, Skeleton, Switch, Tabs, Toggle, ToggleGroup, Tooltip, Sonner (toasts). Based on Radix UI with CVA (class-variance-authority) styling.

---

## Custom Hooks

### Data Fetching

| Hook | File | Description |
|---|---|---|
| `useFetchApi<T>(url, options?, refreshInterval?)` | `hooks/api.ts` | Generic typed fetch hook. Returns `{ data, isLoading, error, refetch }`. Supports refresh intervals and listens for `stela:sync` custom events to trigger refetches. |
| `useInscriptions(params?)` | `hooks/useInscriptions.ts` | Fetches paginated inscription list from `/api/inscriptions`. Auto-refreshes every 15 seconds. |
| `useInscription(id)` | `hooks/useInscription.ts` | Reads inscription data directly from the StarkNet contract via `useReadContract` with the `get_inscription` function. Watches for updates. |
| `useInscriptionAssets(id)` | `hooks/useInscriptionAssets.ts` | Fetches asset details from `/api/inscriptions/:id` (D1). |
| `useShares(id)` | `hooks/useShares.ts` | Reads ERC1155 `balance_of` for the connected wallet directly from the StarkNet contract. |
| `usePortfolio(address)` | `hooks/usePortfolio.ts` | Aggregates data from four API endpoints (`/api/inscriptions`, `/api/shares/:address`, `/api/treasury/:address`, `/api/orders`) to build lending, borrowing, and redeemable position lists with summary metrics. Includes orders tab. |
| `useTokenBalances()` | `hooks/useTokenBalances.ts` | Fetches ERC20 `balance_of` for all known network tokens via direct RPC calls. Returns a `Map<tokenAddress, bigint>`. |
| `useOrders(params?)` | `hooks/useOrders.ts` | Fetches off-chain orders from `/api/orders`. Auto-refreshes every 10 seconds. |
| `useOrder(id)` | `hooks/useOrders.ts` | Fetches single order detail with offers. Auto-refreshes every 5 seconds. |

### Transaction Hooks

| Hook | File | Description |
|---|---|---|
| `useSignInscription(id)` | `hooks/transactions.ts` | Builds ERC20 approval calls for debt tokens (proportional to BPS) + `sign_inscription` call. Sends as atomic multicall. |
| `useRepayInscription(id)` | `hooks/transactions.ts` | Builds ERC20 approval calls for debt + interest tokens + `repay` call. Sends as atomic multicall. |
| `useCancelInscription(id)` | `hooks/transactions.ts` | Sends `cancel_inscription` call. |
| `useLiquidateInscription(id)` | `hooks/transactions.ts` | Sends `liquidate` call. |
| `useRedeemShares(id)` | `hooks/transactions.ts` | Sends `redeem` call with the user's share amount. |
| `useBatchSign()` | `hooks/useBatchSign.ts` | Aggregates ERC20 approvals across multiple inscriptions (using U128_MAX for approval efficiency) + multiple `sign_inscription` calls. Single atomic multicall. |
| `useSignOrder(orderId)` | `hooks/useSignOrder.ts` | Approve tokens + on-chain `settle()` via SDK's `InscriptionClient.buildSettle()`. Accepts `(bps, progress?)` and uses `TransactionProgress` for step tracking. |
| `useTransactionProgress(steps)` | `hooks/useTransactionProgress.ts` | State machine managing step-by-step transaction UI. Exposes `start()`, `advance()`, `fail(message)`, `setTxHash(hash)`, `close()`. Steps transition: `idle` -> `active` -> `success` or `error`. |
| `useSync()` | `hooks/useSync.ts` | POSTs to `/api/sync` after transactions to immediately index events. Dispatches `stela:sync` custom event to trigger refetches across all `useFetchApi` consumers. |

All transaction hooks use `InscriptionClient` from `@fepvenancio/stela-sdk` to build calldata. The `sendTxWithToast` helper centralizes the try/catch + toast notification pattern.

### Context Hooks

| Hook | File | Description |
|---|---|---|
| `useBatchSelection()` | `hooks/useBatchSelection.tsx` | React context for managing batch inscription selections on the browse page. Provides `toggle`, `isSelected`, `clearAll`, `count`. Max 10 selections. |
| `ensureStarknetContext(ctx)` | `hooks/ensure-context.ts` | Throws if wallet not connected (narrows types for transaction handlers). |
| `isStarknetReady(ctx)` | `hooks/ensure-context.ts` | Non-throwing check for conditional rendering / `enabled` guards. |

---

## State Management

The frontend uses two data sources with different trust levels:

### Contract Reads (Source of Truth)

For authoritative state, hooks read directly from the StarkNet contract:

- `useInscription(id)` -- Reads `get_inscription` via `useReadContract` (starknet-react)
- `useShares(id)` -- Reads `balance_of` via `useReadContract`
- `useTokenBalances()` -- Reads ERC20 `balance_of` via direct RPC calls

These hooks have `watch: true` enabled, so they auto-refresh on new blocks.

### D1 API (Indexed Data)

For listing, searching, filtering, and aggregation, the frontend queries D1 via API routes:

- `useInscriptions()` -- Browse page listing
- `useInscriptionAssets()` -- Asset details (not available from a single contract read)
- `usePortfolio()` -- Multi-endpoint aggregation
- `useOrders()` -- Off-chain orders

These are fetched via `useFetchApi` with configurable refresh intervals (5-15 seconds).

### Sync Bridge

After any on-chain transaction, `useSync` calls `POST /api/sync` which:
1. Waits for the transaction receipt via `provider.waitForTransaction(tx_hash)`
2. Parses emitted Stela events from the receipt
3. Writes the data to D1 immediately
4. Dispatches a `stela:sync` browser event, causing all `useFetchApi` hooks to refetch

This ensures the UI updates immediately after a transaction, without waiting for the Apibara indexer to catch up.

---

## Wallet Integration

### Configuration

Wallet providers are configured in `src/app/providers.tsx`:

```typescript
const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

const provider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: rpcUrl }),
})

const connectors = [argent(), braavos()]
```

The app supports **Argent X** and **Braavos** wallets. Auto-connect is enabled.

### RPC Endpoint

The RPC URL is configured via `NEXT_PUBLIC_RPC_URL` environment variable. Default: `https://api.cartridge.gg/x/starknet/sepolia`.

### Transaction Pattern

All write transactions follow this pattern:

1. Validate wallet connection via `ensureStarknetContext`
2. Build calldata using `InscriptionClient` from `@fepvenancio/stela-sdk`
3. For transactions requiring token approvals, build `approve` calls with the required amounts
4. Send all calls as a single atomic multicall via `useSendTransaction` from `@starknet-react/core`
5. Show success/error toast via `sendTxWithToast`
6. Trigger D1 sync via `useSync`

---

## Utility Libraries

| File | Exports | Purpose |
|---|---|---|
| `lib/config.ts` | `NETWORK`, `CONTRACT_ADDRESS`, `RPC_URL` | Resolved from environment variables and SDK defaults |
| `lib/connectors.ts` | `connectors` | Wallet connector instances (Argent, Braavos) |
| `lib/status.ts` | `computeStatus()`, `enrichStatus()` | Delegates to SDK's `computeStatus` for canonical status computation |
| `lib/tx.ts` | `sendTxWithToast()`, `getErrorMessage()` | Centralized transaction execution with toast notifications |
| `lib/offchain.ts` | `getInscriptionOrderTypedData()`, `getLendOfferTypedData()`, `hashAssets()`, `getNonce()`, `getCancelOrderTypedData()` | Re-exports from SDK for SNIP-12 typed data construction and app-local cancel typed data |
| `lib/format.ts` | `formatTokenValue()`, `formatDuration()`, `formatTimestamp()` | Display formatting for token values, durations, and timestamps |
| `lib/amount.ts` | `parseAmount()` | Convert human-readable amounts (e.g., "1.5") to on-chain bigint values |
| `lib/address.ts` | `formatAddress()`, `normalizeAddress()`, `addressesEqual()` | StarkNet address formatting, normalization, and comparison |
| `lib/schemas.ts` | `inscriptionListSchema`, `inscriptionIdSchema`, `addressSchema`, `syncRequestSchema` | Zod validation schemas for API route parameters |
| `lib/validation.ts` | `createOrderSchema`, `createOfferSchema`, `cancelOrderSchema` | Zod validation schemas for write API request bodies |
| `lib/api.ts` | `getD1()`, `jsonResponse()`, `errorResponse()`, `handleOptions()`, `rateLimit()`, `logError()` | Shared API route utilities: D1 access, CORS, rate limiting, structured error responses |
| `lib/rate-limit.ts` | `isRateLimited()`, `isAddressRateLimited()`, `MAX_BODY_SIZE` | Sliding-window in-memory rate limiter (IP + address based) |
| `lib/errors.ts` | `AppError`, `NotFoundError`, `UnauthorizedError`, `ValidationError`, `RateLimitError` | Error class hierarchy for centralized API error handling |
| `lib/verify-signature.ts` | `verifyStarknetSignature()` | Server-side SNIP-12 signature verification via raw JSON-RPC |
| `lib/verify-nonce.ts` | `verifyNonce()` | Server-side on-chain nonce verification via raw JSON-RPC |
| `lib/order-utils.ts` | `normalizeOrderData()`, `parseOrderRow()` | Shared order_data JSON normalization (camelCase/snake_case variants) |
| `lib/filter-utils.ts` | Filter/search utilities | Shared filtering logic for browse page |
| `lib/utils.ts` | `cn()` | Tailwind CSS class merging utility (clsx + tailwind-merge) |
