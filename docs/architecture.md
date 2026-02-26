# Architecture

## Monorepo Structure

```
stela-app/
├── packages/
│   └── core/                      @stela/core -- shared types, ABI, constants, D1 queries
├── apps/
│   └── web/                       Next.js 15 frontend (OpenNext -> Cloudflare Workers)
├── services/
│   └── indexer/                   Apibara DNA streaming -> webhook POST (Node.js)
├── workers/
│   ├── indexer/                   Webhook receiver -> D1 + cron expiry (CF Worker)
│   └── bot/                       Liquidation + settlement cron (CF Worker)
├── package.json                   pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

### Workspace Configuration

All four directories are registered as pnpm workspaces:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'workers/*'
  - 'services/*'
```

Turborepo orchestrates builds with dependency awareness:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", ".open-next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "deploy": { "dependsOn": ["^build"], "cache": false },
    "lint": {}
  }
}
```

The `^build` dependency means `@stela/core` is always built before any package that depends on it.

---

## Data Flow

```
StarkNet (Sepolia)
    |
    | gRPC stream (events)
    v
services/indexer (Apibara DNA)
    |
    | HTTP POST /webhook/events (Bearer auth)
    v
workers/indexer (Cloudflare Worker)
    |
    | D1 writes (upsert inscriptions, assets, events, share balances)
    v
Cloudflare D1 (stela-db)
    ^
    | D1 reads (direct binding, no network hop)
    |
apps/web API routes (Next.js on Cloudflare Workers)
    |
    | JSON responses
    v
apps/web frontend (React client components)
    |
    | Direct contract calls via wallet (starknet.js)
    v
StarkNet (Sepolia)
```

### Event Flow (Indexing)

1. **Apibara DNA** streams StarkNet events matching the Stela contract address via gRPC.
2. **services/indexer** (Node.js process) receives raw events, parses them, enriches data via StarkNet RPC calls (`get_inscription`, `get_locker`), and extracts asset details from transaction calldata.
3. The service POSTs batched `WebhookPayload` objects to the CF Worker's `/webhook/events` endpoint, authenticated with a shared Bearer token.
4. **workers/indexer** validates the payload with Zod schemas, checks idempotency via block cursor, and dispatches each event to its handler (created, signed, cancelled, repaid, liquidated, redeemed, transfer_single, order_settled).
5. Handlers write to D1 tables: `inscriptions`, `inscription_assets`, `inscription_events`, `lockers`, `share_balances`.

### Write Flow (User Transactions)

Users sign transactions directly with their StarkNet wallet. The frontend never proxies writes. Transaction types:

| Action | Entrypoint | Who |
|---|---|---|
| Create inscription | `create_inscription` | Borrower |
| Sign/lend | `sign_inscription` | Lender |
| Repay | `repay` | Borrower |
| Cancel | `cancel_inscription` | Borrower (before signing) |
| Liquidate | `liquidate` | Anyone (after expiry) |
| Redeem shares | `redeem` | Share holder |

After a successful transaction, the frontend calls `POST /api/sync` with the `tx_hash`. This endpoint waits for the transaction receipt, parses emitted events, and writes them to D1 immediately -- bridging the gap until the Apibara indexer catches up.

### Off-Chain Order Flow (SNIP-12 Signatures)

The protocol supports gasless order creation via off-chain SNIP-12 typed data signatures:

1. **Borrower** signs an `InscriptionOrder` typed data message off-chain (no gas) and POSTs it to `POST /api/orders`.
2. **Lender** fetches the order, signs a `LendOffer` typed data message, and POSTs it to `POST /api/orders/:id/offer`.
3. The order status transitions: `pending` -> `matched`.
4. **workers/bot** picks up matched orders on its cron schedule and calls the on-chain `settle` entrypoint with both signatures and full calldata.
5. The settlement creates the inscription on-chain in a single transaction.

---

## Cloudflare Stack

All runtime infrastructure runs on Cloudflare:

| Component | Cloudflare Service | Purpose |
|---|---|---|
| `apps/web` | Workers (via OpenNext) | Next.js 15 SSR frontend |
| `workers/indexer` | Workers + Cron Trigger (`*/5 * * * *`) | Webhook receiver, expiry cron |
| `workers/bot` | Workers + Cron Trigger (`*/2 * * * *`) | Liquidation, settlement, order expiry |
| D1 (`stela-db`) | D1 (SQLite) | Shared database for all services |

### D1 Database (`stela-db`)

**Database ID:** `e8633170-f033-4e41-8c45-ab59f07d4006`

All Workers and the Next.js API routes share the same D1 database via Wrangler bindings. The database is accessed through `createD1Queries(env.DB)` from `@stela/core`.

#### Tables

| Table | Purpose |
|---|---|
| `inscriptions` | Main inscription state (status, participants, timestamps, counters) |
| `inscription_assets` | Per-inscription assets by role (debt, interest, collateral) with address, type, value, token_id |
| `inscription_events` | Event log with tx_hash, block_number, and JSON data payload |
| `lockers` | Mapping of inscription_id to locker TBA contract address |
| `share_balances` | ERC1155 share balances per account per inscription |
| `orders` | Off-chain SNIP-12 signed orders (borrower signatures, order data JSON) |
| `order_offers` | Lender offers against orders (lender signatures, BPS amounts) |
| `_meta` | Key-value store for indexer block cursor |

Schema files:
- `packages/core/src/schema.sql` -- main tables
- `packages/core/src/schema-orders.sql` -- order/offer tables

---

## Package Dependencies

```
@stela/core (packages/core)
├── starknet ^6.23.1
└── typescript ^5.7.0

web (apps/web)
├── @stela/core (workspace)
├── @fepvenancio/stela-sdk ^0.2.0
├── @opennextjs/cloudflare ^1.0.0
├── @starknet-react/core ^3.7.0
├── @starknet-react/chains ^3.1.0
├── starknet ^6.23.1
├── next ^15.2.0
├── react ^19.0.0
├── tailwindcss ^4.0.0
├── zod ^4.3.6
└── (+ UI: radix-ui, lucide-react, sonner, class-variance-authority, etc.)

stela-indexer (workers/indexer)
├── @stela/core (workspace)
└── zod ^4.3.6

stela-bot (workers/bot)
├── @stela/core (workspace)
└── starknet ^9.2.1

stela-apibara-indexer (services/indexer)
├── @stela/core (workspace)
├── @apibara/indexer ^2.0.0-beta.0
├── @apibara/protocol ^2.0.0-beta.0
├── @apibara/starknet ^2.0.0-beta.0
├── nice-grpc-common ^2.0.2
└── starknet ^6.23.1
```

### Key External Dependencies

- **`@fepvenancio/stela-sdk`** -- TypeScript SDK published on npm. Provides `InscriptionClient`, `ShareClient`, `LockerClient`, `computeStatus()`, `parseEvents()`, typed data builders for SNIP-12 signing, token registry, and u256 utilities. The frontend delegates all protocol logic to this SDK.
- **`@stela/core`** -- Internal workspace package. Contains D1 query module (`createD1Queries`), shared types, ABI JSON, constants, u256 helpers, and token registry. Consumed by all workers and the frontend API routes.
- **`@opennextjs/cloudflare`** -- Adapter that compiles Next.js output into a Cloudflare Worker with D1 bindings and static asset serving.
- **`@apibara/indexer` / `@apibara/starknet`** -- Apibara v2 beta SDK for gRPC-based StarkNet event streaming.
- **`starknet`** -- StarkNet.js v6 for RPC calls, account execution, typed data hashing, and address utilities.

---

## Shared Package: `@stela/core`

This package is the single source of truth for types, ABI, and database access within the monorepo.

### Exports

| Export | Description |
|---|---|
| `createD1Queries(db)` | Factory returning all D1 query methods. Used by workers and API routes. |
| `D1Database`, `D1Queries` | TypeScript interfaces for D1 access without requiring `@cloudflare/workers-types` |
| `toU256(bigint)` | Convert bigint to `[low, high]` calldata pair |
| `fromU256({low, high})` | Convert u256 pair back to bigint |
| `inscriptionIdToHex({low, high})` | Convert u256 to 0x-prefixed 64-char hex string |
| `MAX_BPS` | Constant `10_000n` |
| `STELA_ADDRESS` | Contract addresses by network |
| `resolveNetwork(raw?)` | Validate network string, defaulting to `'sepolia'` |
| `VALID_STATUSES`, `STATUS_LABELS` | Inscription status constants |
| `ASSET_TYPE_ENUM`, `ASSET_TYPE_NAMES` | Numeric enum mapping for asset types (ERC20=0, ERC721=1, ERC1155=2, ERC4626=3) |
| `TOKENS`, `getTokensForNetwork()`, `findTokenByAddress()` | Token registry with addresses per network |
| `WebhookEvent`, `WebhookPayload` | Types for the indexer webhook protocol |

### ABI Sync

The contract ABI is stored at `packages/core/src/abi/stela.json` and synced from the contracts repo:

```bash
pnpm sync-abi
```

This runs `scripts/sync-abi.mjs` at the workspace root.
