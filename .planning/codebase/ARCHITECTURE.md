# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Event-driven monorepo with a Cloudflare-first serverless architecture

**Key Characteristics:**
- All compute runs on Cloudflare Workers (no traditional servers)
- Shared SQLite state via Cloudflare D1, accessed by all Workers and frontend API routes
- On-chain writes go directly through user wallets (no backend proxy for user transactions)
- Off-chain order matching with SNIP-12 typed signatures stored in D1, settled on-chain by a bot
- One canonical data access layer (`@stela/core`'s `createD1Queries`) used by every service

## Layers

**Shared Core (`packages/core`):**
- Purpose: Single source of truth for types, ABI, constants, D1 query logic, calldata serialization
- Location: `packages/core/src/`
- Contains: TypeScript types, Zod schemas, D1 query factory, u256 helpers, token registry, calldata utilities, order service logic
- Depends on: Nothing internal; external deps are `starknet`, `zod`
- Used by: All three apps (`web`, `workers/indexer`, `workers/bot`) and `services/indexer`

**Frontend App (`apps/web`):**
- Purpose: Next.js 15 App Router UI deployed to Cloudflare Workers via OpenNext
- Location: `apps/web/src/`
- Contains: Pages, React components, custom hooks, API routes, server-side utility libs
- Depends on: `@stela/core`, `@fepvenancio/stela-sdk`, `@starknet-react/core`, `starknet`
- Used by: End users via browser

**API Routes (`apps/web/src/app/api/`):**
- Purpose: BFF (Backend for Frontend) — validates input, enforces rate limits, verifies signatures, reads/writes D1
- Location: `apps/web/src/app/api/`
- Contains: Route handlers for inscriptions, orders, offers, shares, lockers, treasury, nonces
- Depends on: `@stela/core` (`createD1Queries`), `@opennextjs/cloudflare` (`getCloudflareContext`)
- Used by: Frontend hooks via `fetch()`

**Indexer Service (`services/indexer`):**
- Purpose: Streams StarkNet contract events from Apibara DNA gRPC, transforms and enriches them, then POSTs to the Indexer Worker webhook
- Location: `services/indexer/src/`
- Contains: Apibara stream client, event transform/enrichment logic, webhook poster
- Depends on: `@stela/core` (types, ABI), `@apibara/*`, `starknet` (RPC enrichment)
- Used by: Indexer Worker webhook endpoint

**Indexer Worker (`workers/indexer`):**
- Purpose: Webhook receiver that writes Apibara events to D1; cron to expire stale inscriptions and poll RPC as fallback
- Location: `workers/indexer/src/`
- Contains: `fetch` handler (auth, idempotency, event dispatch), `scheduled` handler (expire + RPC poll fallback)
- Depends on: `@stela/core`
- Used by: Apibara indexer service (via HTTP POST)

**Bot Worker (`workers/bot`):**
- Purpose: Automated cron (every 2 min) to expire stale orders, settle matched on-chain orders, and liquidate expired inscriptions
- Location: `workers/bot/src/`
- Contains: `scheduled` handler with D1 distributed lock, settle/liquidate helpers
- Depends on: `@stela/core`, `starknet` (Account.execute)
- Used by: Cloudflare cron scheduler

## Data Flow

**On-Chain Inscription Lifecycle (indexer path):**

1. User calls contract directly from wallet (create/sign/repay/cancel/liquidate)
2. StarkNet emits contract events
3. `services/indexer` streams events from Apibara DNA gRPC
4. Indexer service transforms raw event data + enriches via StarkNet RPC
5. Indexer service POSTs `WebhookPayload` to `workers/indexer/webhook/events`
6. Indexer Worker authenticates request (timing-safe Bearer token), validates payload, deduplicates by block number
7. `processWebhookEvent()` dispatches to per-event handlers → `createD1Queries` writes to D1
8. Frontend API routes read D1 via `getD1()` → `createD1Queries`

**Off-Chain Order Flow:**

1. Borrower signs `InscriptionOrder` SNIP-12 typed data in wallet
2. Frontend POSTs to `/api/orders` with borrower signature
3. API route verifies SNIP-12 signature server-side + validates on-chain nonce via RPC
4. Order stored in D1 `orders` table with status `pending`
5. Lender views order via `/api/orders` (GET), signs `LendOffer` SNIP-12 typed data
6. Frontend POSTs offer to `/api/orders/:id/offer` — status becomes `matched`
7. Bot Worker cron reads matched orders, builds `settle()` calldata, calls `account.execute()`
8. `InscriptionSigned` event emitted on-chain → Indexer picks up → D1 inscription updated

**Instant Public Settlement (frontend path):**

1. Lender in `useSignOrder` signs LendOffer, then immediately calls `account.execute([approves, settleCall])` in the same wallet session
2. On tx confirmation, offer is stored in D1 as already-settled (no bot involvement)

**State Management:**
- Server state: React Query-style pattern via `useInfiniteApi`, `useInscriptions`, `useOrders` hooks fetching from API routes
- Wallet/chain state: `@starknet-react/core` context wrapping entire app via `Providers` in `apps/web/src/app/providers.tsx`
- No Redux or global client store; all server state flows through API routes → hooks

## Key Abstractions

**`createD1Queries(db)`:**
- Purpose: Factory that wraps a D1Database binding and returns all query methods
- Examples: `packages/core/src/d1.ts`
- Pattern: Single import, call with `env.DB` binding; returns typed query methods with prepared statements

**`WebhookEvent` / `WebhookPayload`:**
- Purpose: Typed contract between indexer service and indexer worker
- Examples: `packages/core/src/types.ts`
- Pattern: `{ block_number, events[], cursor }` — worker checks idempotency via `block_number`

**`processWebhookEvent(event, queries)`:**
- Purpose: Event dispatcher from indexer webhook to per-event D1 handlers
- Examples: `workers/indexer/src/handlers/index.ts`
- Pattern: Switch on `event.event_type`, each handler validates with Zod, writes to D1

**`processCreateOrder(db, params, options)`:**
- Purpose: Shared service layer for order creation (signature verification, nonce check, idempotency)
- Examples: `packages/core/src/services/orders.ts`
- Pattern: Injected dependencies (`verifySignature`, `verifyNonce`) for testability; used by API route

**`InscriptionClient` (SDK):**
- Purpose: Builds StarkNet calldata for contract interactions
- Examples: Used in `apps/web/src/hooks/useSignOrder.ts`, `useCreateInscription.ts`
- Pattern: `client.buildSettle(...)` returns a call object passed to `account.execute()`

**u256 Helpers:**
- Purpose: Convert between JavaScript `bigint` and Cairo's two-felt u256 representation
- Examples: `packages/core/src/u256.ts`
- Pattern: `toU256(bigint)` → `[low, high]` calldata pair; `fromU256({low, high})` → `bigint`

## Entry Points

**Frontend:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: HTTP request from browser via Cloudflare Workers (OpenNext)
- Responsibilities: Wraps app in `Providers` (StarkNet context), `AppShell` (nav), `TermsGate`

**Indexer Service:**
- Location: `services/indexer/src/index.ts`
- Triggers: Process startup (deployed to Railway)
- Responsibilities: Infinite retry loop calling `runOnce()` which establishes Apibara gRPC stream

**Indexer Worker:**
- Location: `workers/indexer/src/index.ts`
- Triggers: HTTP POST (webhook from indexer service), `scheduled` (cron every 5 min)
- Responsibilities: Authenticate webhook, write events to D1, expire inscriptions, poll RPC fallback

**Bot Worker:**
- Location: `workers/bot/src/index.ts`
- Triggers: `scheduled` cron (every 2 min)
- Responsibilities: Acquire D1 lock, expire orders, expire stale-nonce orders, purge signatures, settle matched orders, liquidate expired inscriptions

## Error Handling

**Strategy:** Fail-closed on security checks; best-effort on automation; structured error types in API layer

**Patterns:**
- API routes use `AppError` / `NotFoundError` / `UnauthorizedError` from `apps/web/src/lib/errors.ts`; converted to typed JSON via `errorResponse()`
- `verifyNonce` in `apps/web/src/lib/verify-nonce.ts` fails closed — if RPC is down, order creation is rejected
- Bot worker leaves failed settlements as `matched` for retry on next cron run
- Indexer service uses exponential backoff (5s initial, 5min max) with infinite retries on stream errors
- `logError()` in API helper logs only error name (not message) to avoid leaking D1 schema details
- D1 rate limit check (`rateLimitWrite`) fails closed — returns 503 if D1 check itself errors

## Cross-Cutting Concerns

**Rate Limiting:** Dual-layer — in-memory sliding window (`apps/web/src/lib/rate-limit.ts`) + D1-backed persistent counter (`checkWriteRateLimit` in `d1.ts`); applied in `apps/web/src/lib/api.ts` via `rateLimit()` and `rateLimitWrite()`

**CORS:** Origin allowlist (`stela-dapp.xyz`) enforced in `corsHeaders()` in `apps/web/src/lib/api.ts`; all API responses include CORS headers

**Signature Verification:** Server-side SNIP-12 hash reconstruction + `is_valid_signature` on-chain call via raw `starknet_call` RPC; implemented in `apps/web/src/lib/verify-signature.ts`; never trusts client-provided hashes

**Distributed Locking:** `_meta` D1 table used as TTL-based mutex for bot cron (`tryAcquireLock`/`setMeta`); prevents overlapping runs across Cloudflare Worker instances

**Nonce Management:** Every order stores borrower nonce at signing time; bot and lender-side frontend both verify on-chain nonce matches before attempting settlement; mismatches result in order expiry

---

*Architecture analysis: 2026-03-18*
