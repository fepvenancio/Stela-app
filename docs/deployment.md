# Deployment Guide

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10.28.0 (via corepack: `corepack enable`)
- **Cloudflare account** with Workers and D1 access
- **Wrangler CLI** (installed as devDependency, or globally: `npm install -g wrangler`)
- **Apibara DNA token** (for the streaming indexer service)
- **StarkNet RPC endpoint** (e.g., Cartridge, Lava, Alchemy)
- **Bot wallet** with Sepolia ETH/STRK for gas (for the liquidation/settlement bot)

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/fepvenancio/stela-app.git
cd stela-app
pnpm install
```

### 2. Authenticate Wrangler

```bash
npx wrangler login
```

### 3. Create the D1 Database

If deploying to a new Cloudflare account, create the D1 database:

```bash
npx wrangler d1 create stela-db
```

Update the `database_id` in all three `wrangler.jsonc` files:
- `apps/web/wrangler.jsonc`
- `workers/indexer/wrangler.jsonc`
- `workers/bot/wrangler.jsonc`

### 4. Apply D1 Schema

```bash
npx wrangler d1 execute stela-db --file=packages/core/src/schema.sql
npx wrangler d1 execute stela-db --file=packages/core/src/schema-orders.sql
```

For local development with a local D1 database:

```bash
npx wrangler d1 execute stela-db --local --file=packages/core/src/schema.sql
npx wrangler d1 execute stela-db --local --file=packages/core/src/schema-orders.sql
```

---

## Build

Build all packages in dependency order:

```bash
pnpm build
```

This runs Turborepo which builds `@stela/core` first, then all dependent packages in parallel.

To build individual packages:

```bash
pnpm --filter @stela/core build   # shared package
pnpm --filter web build            # Next.js frontend
pnpm --filter stela-indexer build  # indexer worker (tsc)
pnpm --filter stela-bot build     # bot worker (tsc)
pnpm --filter stela-apibara-indexer build  # Apibara service
```

Lint all packages:

```bash
pnpm lint
```

---

## Deploy: Frontend (`apps/web`)

### Environment Variables

Set in `apps/web/wrangler.jsonc` under `vars`:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_NETWORK` | StarkNet network | `sepolia` |
| `NEXT_PUBLIC_STELA_ADDRESS` | Stela contract address | `0x006885f85de...` |
| `NEXT_PUBLIC_RPC_URL` | StarkNet RPC endpoint | `https://api.cartridge.gg/x/starknet/sepolia` |

### Custom Domain

Routes are configured in `wrangler.jsonc`:

```json
"routes": [
  { "pattern": "stela-dapp.xyz", "custom_domain": true },
  { "pattern": "www.stela-dapp.xyz", "custom_domain": true }
]
```

### Deploy Commands

```bash
# Local preview in workerd
pnpm --filter web preview

# Deploy to Cloudflare Workers
pnpm --filter web deploy
```

Under the hood, this runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`, which:
1. Builds the Next.js app
2. Converts it to a Cloudflare Worker via OpenNext
3. Deploys the worker with D1 bindings and static assets

---

## Deploy: Indexer Worker (`workers/indexer`)

### Configuration (`workers/indexer/wrangler.jsonc`)

```jsonc
{
  // account_id: set via CLOUDFLARE_ACCOUNT_ID env var
  "name": "stela-indexer",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "stela-db",
      "database_id": "e8633170-f033-4e41-8c45-ab59f07d4006"
    }
  ],
  "vars": {
    "STELA_ADDRESS": "0x006885f85de0e79efc7826e2ca19ef8a13e5e4516897ad52dc505723f8ce6b90"
  },
  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}
```

### Secrets

```bash
cd workers/indexer
npx wrangler secret put WEBHOOK_SECRET
```

The `WEBHOOK_SECRET` must match the secret configured for the Apibara indexer service.

### Deploy

```bash
cd workers/indexer
pnpm deploy
```

### Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Returns `{ ok: true, last_block }` |
| `/webhook/events` | POST | Bearer token | Receives webhook payloads from the Apibara service |

### Cron Behavior

The `*/5 * * * *` cron trigger runs `expireOpenInscriptions(nowSeconds)` to mark open inscriptions past their deadline as expired.

---

## Deploy: Bot Worker (`workers/bot`)

### Configuration (`workers/bot/wrangler.jsonc`)

```jsonc
{
  // account_id: set via CLOUDFLARE_ACCOUNT_ID env var
  "name": "stela-bot",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "stela-db",
      "database_id": "e8633170-f033-4e41-8c45-ab59f07d4006"
    }
  ],
  "vars": {
    "STELA_ADDRESS": "0x006885f85de0e79efc7826e2ca19ef8a13e5e4516897ad52dc505723f8ce6b90"
  },
  "triggers": {
    "crons": ["*/2 * * * *"]
  }
}
```

### Secrets

**CRITICAL: Never commit bot credentials. Always use `wrangler secret put`.**

```bash
cd workers/bot
npx wrangler secret put BOT_PRIVATE_KEY
npx wrangler secret put BOT_ADDRESS
npx wrangler secret put RPC_URL
```

The bot wallet must hold enough ETH/STRK to pay gas for liquidation and settlement transactions.

### Deploy

```bash
cd workers/bot
pnpm deploy
```

### Cron Behavior (`*/2 * * * *`)

Every 2 minutes, the bot:

1. **Expires stale orders** -- Updates off-chain orders past their deadline to `expired` status.
2. **Settles matched orders** -- Finds orders with status `matched` and pending offers, builds the full `settle` calldata (order struct, asset arrays, borrower signature, offer struct, lender signature), and executes the on-chain transaction.
3. **Liquidates expired inscriptions** -- Queries D1 for inscriptions where `status = 'filled'` and `signed_at + duration < now`, then calls `liquidate` on each.

Operations are serialized to avoid StarkNet nonce conflicts.

---

## Deploy: Apibara Indexer Service (`services/indexer`)

This is a long-running Node.js process (not a Cloudflare Worker). Deploy to Railway, Fly.io, or any container platform.

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cd services/indexer
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `DNA_TOKEN` | Apibara DNA API token | `dna_xxx` |
| `WEBHOOK_URL` | Base URL of the indexer CF Worker | `https://stela-indexer.stela-app.workers.dev` |
| `WEBHOOK_SECRET` | Shared secret for webhook auth | Must match the worker's `WEBHOOK_SECRET` |
| `RPC_URL` | StarkNet RPC for enrichment calls | `https://api.cartridge.gg/x/starknet/sepolia` |
| `STELA_ADDRESS` | Stela contract address | `0x006885f85de...` |

### Run Locally

```bash
cd services/indexer
pnpm dev    # tsx --watch src/index.ts
```

### Docker Deployment

A multi-stage Dockerfile is provided:

```bash
docker build -f services/indexer/Dockerfile -t stela-indexer .
docker run --env-file services/indexer/.env stela-indexer
```

The Dockerfile copies both `packages/core` and `services/indexer`, builds them in order, and runs `node services/indexer/dist/index.js` in production.

### Behavior

The service:
1. Fetches the last indexed block from the CF Worker's `/health` endpoint
2. Connects to Apibara DNA (Sepolia) via gRPC at `https://sepolia.starknet.a5a.ch`
3. Streams events matching the Stela contract address with `finality: 'accepted'`
4. For each block with events:
   - Parses event selectors (InscriptionCreated, InscriptionSigned, InscriptionCancelled, InscriptionRepaid, InscriptionLiquidated, SharesRedeemed, TransferSingle)
   - Enriches via RPC (fetches on-chain inscription data, locker addresses)
   - Extracts asset details from transaction calldata (for create events)
   - Batches events into a `WebhookPayload` and POSTs to the CF Worker
5. On stream failure, reconnects with exponential backoff (5s initial, 5m max)

---

## D1 Schema Migration

When adding new tables or columns:

1. Update `packages/core/src/schema.sql` or `packages/core/src/schema-orders.sql`
2. Apply to production:
   ```bash
   npx wrangler d1 execute stela-db --file=packages/core/src/schema.sql
   ```
3. Apply to local dev:
   ```bash
   npx wrangler d1 execute stela-db --local --file=packages/core/src/schema.sql
   ```

All DDL statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, making them safe to re-run.

---

## Secret Management Summary

| Service | Secret | How to Set |
|---|---|---|
| `workers/indexer` | `WEBHOOK_SECRET` | `wrangler secret put WEBHOOK_SECRET` |
| `workers/bot` | `BOT_PRIVATE_KEY` | `wrangler secret put BOT_PRIVATE_KEY` |
| `workers/bot` | `BOT_ADDRESS` | `wrangler secret put BOT_ADDRESS` |
| `workers/bot` | `RPC_URL` | `wrangler secret put RPC_URL` |
| `services/indexer` | `DNA_TOKEN` | `.env` file or container env vars |
| `services/indexer` | `WEBHOOK_SECRET` | `.env` file or container env vars |
| `services/indexer` | `RPC_URL` | `.env` file or container env vars |

Non-secret variables (contract address, network) are set in `wrangler.jsonc` under `vars`.

---

## Local Development

### Start All Services

```bash
pnpm dev
```

This starts all workspaces in dev mode via Turborepo:
- `apps/web` -- Next.js dev server
- `workers/indexer` -- Wrangler dev (local Worker)
- `workers/bot` -- Wrangler dev (local Worker)
- `services/indexer` -- tsx watch mode

### Local Dev Vars

Workers use `.dev.vars` files for local secrets. Copy from examples:

```bash
cp workers/indexer/.dev.vars.example workers/indexer/.dev.vars
cp workers/bot/.dev.vars.example workers/bot/.dev.vars
```

Edit these files with your local development credentials. They are gitignored.

### ABI Sync

If the Cairo contracts have been updated:

```bash
pnpm sync-abi
```

This copies the ABI from the contracts build output into `packages/core/src/abi/stela.json`.

### Verify Build

```bash
pnpm lint     # TypeScript strict mode check
pnpm build    # Full build of all packages
```

TypeScript strict mode is enforced across all packages. No `any` or `ts-ignore` without explanation.
