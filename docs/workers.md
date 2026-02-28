# Workers Documentation

The Stela backend consists of three worker services:

1. **Indexer Worker** (`workers/indexer`) -- Cloudflare Worker receiving webhook events and running expiry cron
2. **Bot Worker** (`workers/bot`) -- Cloudflare Worker running settlement, liquidation, and order expiry cron
3. **Apibara Indexer Service** (`services/indexer`) -- Long-running Node.js process streaming events via gRPC

---

## Indexer Worker (`workers/indexer`)

**Runtime:** Cloudflare Worker + Cron Trigger (`*/5 * * * *`)
**Dependencies:** `@stela/core` (workspace), `zod`

### Purpose

Receives pre-parsed events from the Apibara service via webhook POST and writes them to D1. Also runs a cron to expire open inscriptions past their deadline.

### Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Returns `{ ok: true, last_block: number }` |
| `/webhook/events` | POST | Bearer token | Receives batched webhook payloads |

### Webhook Processing

`POST /webhook/events` flow:

1. **Authenticate** -- Extract Bearer token from `Authorization` header, compare with `WEBHOOK_SECRET` using timing-safe comparison (`crypto.subtle.timingSafeEqual`)
2. **Validate** -- Parse payload with Zod schemas (`webhookPayloadSchema`)
3. **Idempotency** -- Skip if `payload.block_number <= last_block` from `_meta` table
4. **Process events** -- Dispatch each event to its handler via `processWebhookEvent()`
5. **Advance cursor** -- Update `last_block` in `_meta` table

If any individual event handler fails, processing continues and errors are accumulated. Returns 500 if any events failed, 200 otherwise.

### Event Handlers

| Event Type | Handler | D1 Actions |
|---|---|---|
| `created` | `handleCreated` | `upsertInscription`, `insertAsset` (debt/interest/collateral), `insertEvent` |
| `signed` | `handleSigned` | `upsertInscription` (status, borrower, lender, signed_at), `upsertLocker`, `insertEvent` |
| `cancelled` | `handleCancelled` | `updateInscriptionStatus('cancelled')`, `insertEvent` |
| `repaid` | `handleRepaid` | `updateInscriptionStatus('repaid')`, `insertEvent` |
| `liquidated` | `handleLiquidated` | `updateInscriptionStatus('liquidated')`, `insertEvent` |
| `redeemed` | `handleRedeemed` | `insertEvent` (with redeemer, shares) |
| `transfer_single` | `handleTransferSingle` | `insertEventReturning` (dedup), `incrementShareBalance` / `decrementShareBalance` |
| `order_settled` | `handleOrderSettled` | `updateOrderStatus('settled')` |
| `private_settled` | `handlePrivateSettled` | `insertEvent` (with lender_commitment, shares, private flag) |
| `private_redeemed` | `handlePrivateRedeemed` | `insertEvent` (with nullifier, recipient, shares, private flag) |

The `transfer_single` handler uses `insertEventReturning()` for dedup -- if the event was already processed (unique index on `inscription_id, event_type, tx_hash`), balance mutations are skipped to prevent double-counting.

### Cron Behavior (`*/5 * * * *`)

Every 5 minutes, runs `expireOpenInscriptions(nowSeconds)`:

```sql
UPDATE inscriptions
SET status = 'expired', updated_at_ts = ?
WHERE status = 'open' AND deadline > 0 AND deadline < ?
```

### Configuration

Environment (in `wrangler.jsonc`):
```jsonc
{
  "vars": {
    "STELA_ADDRESS": "0x00b7deedb4ab03d94f54da2e7c911c2336b19c2a4610eb98f55cd7be5a53ece0"
  }
}
```

Secrets (via `wrangler secret put`):
- `WEBHOOK_SECRET` -- Must match the Apibara service's `WEBHOOK_SECRET`

### Source Files

```
workers/indexer/src/
├── index.ts          -- fetch (webhook + health) + scheduled (cron) handlers
├── types.ts          -- Env interface
├── schemas.ts        -- Zod schemas for webhook payload validation
└── handlers/
    └── index.ts      -- processWebhookEvent dispatcher + all event handlers
```

---

## Bot Worker (`workers/bot`)

**Runtime:** Cloudflare Worker + Cron Trigger (`*/2 * * * *`)
**Dependencies:** `@stela/core` (workspace), `starknet ^9.2.1` (v9, NOT v6)

The bot uses **starknet.js v9** because v6 is incompatible with V3 transactions and the v0.8+ RPC spec.

### Purpose

Runs a cron every 2 minutes performing three tasks in sequence:
1. Expire stale off-chain orders past their deadline
2. Settle matched orders on-chain
3. Liquidate expired inscriptions

### D1 Distributed Lock

The bot uses `_meta` table as a distributed lock to prevent overlapping cron runs:

```
Lock key:  'bot_lock'
Lock TTL:  300 seconds (5 minutes)
```

1. Read `bot_lock` from `_meta`
2. If held within TTL window, skip this run
3. Set lock with current timestamp
4. Execute all operations
5. Release lock by setting to `'0'` (best-effort; TTL ensures expiry on crash)

### Cron Operations

#### 1. Expire Stale Orders

```sql
UPDATE orders SET status = 'expired'
WHERE status = 'pending' AND deadline > 0 AND deadline < ?
```

#### 2. Settle Matched Orders

Finds orders with `status = 'matched'` joined with offers where `status = 'pending'` and `deadline > now`. Limited to 20 per run.

For each matched order:

1. Load order + offer from D1
2. Parse `order_data` JSON
3. **Detect private settlement**: if `lender_commitment != 0` and `lender == 0x0`
4. **Pre-settle nonce checks**:
   - Verify borrower's on-chain nonce matches order nonce (expire order if stale)
   - For public settlements: verify lender's on-chain nonce matches offer nonce (expire offer if stale)
   - For private settlements: skip lender nonce check (contract doesn't consume lender nonce in private path)
5. Compute asset hashes via Poseidon (`hash.computePoseidonHashOnElements`)
6. Build settle calldata:
   - Order struct (11 fields): borrower, debt_hash, interest_hash, collateral_hash, counts, duration, deadline, multi_lender, nonce
   - Serialized asset arrays: `[len, ...per-asset(address, type_enum, value_low, value_high, token_id_low, token_id_high)]`
   - Borrower signature: `[len, ...elements]`
   - Offer struct (6 fields): order_hash, lender, bps_low, bps_high, nonce, lender_commitment
   - Lender signature: `[len, ...elements]`
7. Execute `settle()` via `Account.execute()` with 120s timeout
8. On success: update both order and offer status to `settled`
9. On failure: leave as `matched` for retry on next cron run

#### 3. Liquidate Expired Inscriptions

```sql
SELECT id FROM inscriptions
WHERE status = 'filled'
  AND signed_at IS NOT NULL
  AND (signed_at + duration) < ?
ORDER BY (signed_at + duration) ASC
LIMIT 50
```

For each candidate, calls `liquidate(inscription_id)` on-chain with 120s timeout.

All operations within a single cron run are serialized to avoid StarkNet nonce conflicts.

### Configuration

Secrets (via `wrangler secret put`):
- `BOT_PRIVATE_KEY` -- StarkNet private key for the bot account
- `BOT_ADDRESS` -- Bot account address
- `RPC_URL` -- Alchemy v0.8 endpoint (must support V3 transactions)

**CRITICAL:** The bot wallet must hold ETH/STRK for gas. Never commit credentials.

### Deploy

```bash
cd workers/bot
npx wrangler@3 deploy
```

Use `npx wrangler@3 deploy` (NOT `pnpm deploy`) to avoid workerd architecture issues on macOS.

### Source Files

```
workers/bot/src/
└── index.ts    -- All logic: helpers, serialization, liquidation, settlement, scheduled handler
```

---

## Apibara Indexer Service (`services/indexer`)

**Runtime:** Node.js 22 (long-running process)
**Dependencies:** `@stela/core` (workspace), `@apibara/indexer` + `@apibara/starknet` + `@apibara/protocol` (v2 beta), `starknet ^6.23.1`, `nice-grpc-common`

### Purpose

Streams StarkNet events from Apibara DNA via gRPC, transforms and enriches them with RPC data, then POSTs batched webhook payloads to the CF indexer worker for D1 persistence.

### Architecture

```
Apibara DNA (gRPC) --> services/indexer (Node.js) --> HTTP POST --> workers/indexer (CF) --> D1
```

### Startup Sequence

1. Fetch last indexed block from indexer worker's `/health` endpoint
2. Create gRPC client to Apibara DNA at `https://sepolia.starknet.a5a.ch`
3. Authenticate with `DNA_TOKEN` via gRPC metadata
4. Start streaming from `lastBlock + 1` with `finality: 'accepted'`

### Event Filter

Streams events matching:
- **Contract address:** `STELA_ADDRESS` env var
- **Event keys:** All known Stela event selectors (from `ALL_SELECTORS` in `rpc.ts`)
- **Include transactions:** yes (for calldata extraction)

### Transform Pipeline

For each block with events:

1. Extract raw keys/data/transactionHash from stream events
2. Attach transaction calldata from included transactions (invokeV1/V3/V0 variants)
3. Call `transformEvent()` which:
   - Matches event selector to known event types
   - Parses keys/data according to ABI layout (u256 = 2 slots, ContractAddress = 1 slot)
   - Enriches via RPC: `get_inscription()`, `get_locker()` for structural data
   - Extracts asset details from transaction calldata (for `InscriptionCreated`)
4. Batch all webhook events into a `WebhookPayload` with block_number and cursor
5. POST to indexer worker via `postWebhook()` (with retry and backoff)

### Event Types Handled

- InscriptionCreated
- InscriptionSigned
- InscriptionCancelled
- InscriptionRepaid
- InscriptionLiquidated
- SharesRedeemed
- TransferSingle
- PrivateSettled
- PrivateSharesRedeemed

### Retry Strategy

On stream failure, reconnects with exponential backoff:
- Initial delay: 5 seconds
- Maximum delay: 5 minutes
- Max retries: Infinity (runs forever)

On successful reconnection, attempt counter resets to 0.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DNA_TOKEN` | yes | Apibara DNA API authentication token |
| `WEBHOOK_URL` | yes | Base URL of the indexer CF Worker |
| `WEBHOOK_SECRET` | yes | Shared Bearer token for webhook auth |
| `RPC_URL` | yes | StarkNet RPC endpoint for enrichment |
| `STELA_ADDRESS` | yes | Stela contract address (hex) |

### Run

```bash
# Development
cd services/indexer && pnpm dev    # tsx --watch src/index.ts

# Production (Docker)
docker build -f services/indexer/Dockerfile -t stela-indexer .
docker run --env-file services/indexer/.env stela-indexer
```

If encountering OOM errors during local builds: `NODE_OPTIONS="--max-old-space-size=8192"`

### Source Files

```
services/indexer/src/
├── index.ts       -- Entry point: gRPC client, indexer definition, retry loop
├── transform.ts   -- Event parsing + RPC enrichment -> WebhookEvent[]
├── rpc.ts         -- Event selectors, fetchInscriptionFromContract, fetchLockerAddress
└── webhook.ts     -- POST webhook with retry + backoff
```

---

## Order Status Transitions

All off-chain order status transitions across workers:

```
pending --> matched     (lender offer accepted: POST /api/orders/:id/offer without tx_hash)
pending --> settled     (lender settled on-chain: POST /api/orders/:id/offer with tx_hash)
matched --> settled     (bot settles on-chain: workers/bot cron)
pending --> expired     (deadline passed: workers/bot cron calls expireOrders)
pending --> cancelled   (borrower signs cancellation: DELETE /api/orders/:id)
matched --> expired     (bot detects stale nonce during settlement attempt)
```

Offer status transitions:

```
pending --> settled     (bot settles on-chain or user settled with tx_hash)
pending --> expired     (bot detects stale lender nonce during settlement)
```
