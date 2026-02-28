# CLAUDE.md — Stela Monorepo Build Instructions

## Project Overview

Stela is a P2P lending/inscriptions protocol on StarkNet. The contracts are in a separate repo
(`stela-contracts/`). This repo contains everything else: frontend, indexer, and settlement/liquidation bot.

**Everything runs on Cloudflare:** Workers, D1 (SQLite), and OpenNext for the frontend.

Read this entire file before writing any code.

---

## Repo Structure

```
stela-app/                          ← this repo
├── packages/
│   └── core/                      ← shared types, ABI, constants, D1 queries
├── apps/
│   └── web/                       ← Next.js frontend (OpenNext → Cloudflare Workers)
├── services/
│   └── indexer/                   ← Apibara DNA streaming → webhook POST (Node.js)
├── workers/
│   ├── indexer/                   ← Webhook receiver → D1 + cron expiry
│   └── bot/                       ← settlement + liquidation cron Worker → StarkNet
├── package.json                   ← pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Toolchain

```
Runtime:     Cloudflare Workers (workerd)
Database:    Cloudflare D1 (SQLite)
Frontend:    Next.js 15 via @opennextjs/cloudflare
Package mgr: pnpm (workspaces)
Build:       Turborepo
Language:    TypeScript strict mode everywhere
```

---

## Package Manager Setup

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'workers/*'
  - 'services/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", ".open-next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "deploy": { "dependsOn": ["^build"], "cache": false },
    "lint": {}
  }
}
```

---

## Package: @stela/core

**Purpose:** Single source of truth for types, ABI, contract addresses, D1 queries.
Every app and worker imports from here. Never duplicate across packages.

```
packages/core/
├── src/
│   ├── abi/
│   │   └── stela.json         ← copied from contracts build output
│   ├── types.ts               ← Inscription, Asset, AssetType etc
│   ├── constants.ts           ← addresses, MAX_BPS
│   ├── u256.ts                ← bigint <-> u256 felt pair conversion
│   ├── tokens.ts              ← token registry
│   ├── d1.ts                  ← shared D1 query module (all Workers + API routes)
│   ├── schema.sql             ← D1 schema reference
│   └── index.ts               ← re-exports everything
└── package.json
```

### D1 Query Module (`d1.ts`)

All D1 database access goes through `createD1Queries(db)`:

```typescript
import { createD1Queries } from '@stela/core'
import type { D1Database } from '@stela/core'

const queries = createD1Queries(env.DB as unknown as D1Database)
await queries.getInscriptions({ status: 'open', page: 1, limit: 20 })
await queries.upsertInscription({ id, creator, status: 'open', ... })
await queries.findLiquidatable(nowSeconds)
```

**Security:** Column allowlists prevent SQL injection in dynamic upserts.
All queries use prepared statements with `?` parameters.

### Types

```typescript
export type AssetType = 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626'

export type InscriptionStatus =
  | 'open' | 'partial' | 'filled' | 'repaid'
  | 'liquidated' | 'expired' | 'cancelled'

export interface Inscription {
  id: string           // u256 as 0x-prefixed hex string
  borrower: string     // ContractAddress as hex
  lender: string
  duration: bigint     // seconds
  deadline: bigint     // unix timestamp
  signed_at: bigint
  issued_debt_percentage: bigint  // BPS, max 10_000
  is_repaid: boolean
  liquidated: boolean
  multi_lender: boolean
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
  status: InscriptionStatus  // computed by indexer, NOT from contract
}
```

### ABI Sync

```bash
pnpm sync-abi  # copies ABI from contracts build into packages/core/src/abi/stela.json
```

---

## D1 Database (stela-db)

**ID:** `e8633170-f033-4e41-8c45-ab59f07d4006`

SQLite database shared by all Workers and the frontend API routes. Tables:

- `inscriptions` — main inscription state (status, participants, timestamps)
- `inscription_assets` — per-inscription asset details (debt/interest/collateral)
- `inscription_events` — event log for history/auditing
- `lockers` — mapping of inscription_id to locker TBA contract address
- `share_balances` — ERC1155 share balances per account per inscription
- `orders` — off-chain SNIP-12 signed orders (borrower signatures, order data JSON)
- `order_offers` — lender offers against orders (lender signatures, BPS amounts)
- `_meta` — key/value store for indexer block cursor and bot distributed lock

Schema files:
- `packages/core/src/schema.sql` — main tables
- `packages/core/src/schema-orders.sql` — order/offer tables

Apply via:
```bash
wrangler d1 execute stela-db --file=packages/core/src/schema.sql
wrangler d1 execute stela-db --file=packages/core/src/schema-orders.sql
```

---

## App: web (Next.js Frontend)

### Stack
```
Next.js 15 (App Router)
@opennextjs/cloudflare        ← deploy to Cloudflare Workers
Cloudflare D1                  ← API routes query D1 directly
TypeScript strict
Tailwind CSS 4
starknet.js v6
@starknet-react/core v3
```

### Key Files
```
apps/web/
├── wrangler.jsonc             ← D1 binding, assets config, nodejs_compat
├── open-next.config.ts        ← OpenNext config
├── cloudflare-env.d.ts        ← CloudflareEnv type (DB binding)
├── next.config.ts
└── src/
    ├── app/
    │   ├── layout.tsx, page.tsx, providers.tsx
    │   ├── browse/page.tsx
    │   ├── create/page.tsx
    │   ├── docs/page.tsx
    │   ├── faucet/page.tsx
    │   ├── inscription/[id]/page.tsx
    │   ├── order/[id]/page.tsx
    │   ├── portfolio/page.tsx
    │   └── api/
    │       ├── health/route.ts
    │       ├── inscriptions/route.ts
    │       ├── inscriptions/[id]/route.ts
    │       ├── inscriptions/[id]/events/route.ts
    │       ├── inscriptions/[id]/locker/route.ts
    │       ├── lockers/[address]/route.ts
    │       ├── orders/route.ts
    │       ├── orders/[id]/route.ts
    │       ├── orders/[id]/offer/route.ts
    │       ├── shares/[address]/route.ts
    │       ├── sync/route.ts
    │       └── treasury/[address]/route.ts
    ├── components/
    ├── hooks/
    └── lib/
```

### API Routes — D1 Direct Access

API routes query D1 directly via Cloudflare bindings (no external proxy):

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createD1Queries } from '@stela/core'
import type { D1Database } from '@stela/core'

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext()
  const db = createD1Queries(env.DB as unknown as D1Database)
  const inscriptions = await db.getInscriptions({ status, page, limit })
  return NextResponse.json(inscriptions)
}
```

### API Security

**Rate Limiting** — Sliding-window, in-memory rate limiter (`src/lib/rate-limit.ts`):
- IP-based: 60 req/min for reads (GET), 10 req/min for writes (POST/DELETE)
- Address-based: 10 req/min per StarkNet address for write operations
- Max request body size: 50KB (returns 413 if exceeded)
- IP resolved from `cf-connecting-ip` or `x-forwarded-for` headers

**Zod Validation** — All write API routes validate request bodies with Zod schemas (`src/lib/validation.ts`):
- `createOrderSchema` — validates order creation (felt252 format, asset arrays, addresses, signatures)
- `createOfferSchema` — validates lender offers (BPS range 1-10000, signature, nonce)
- `cancelOrderSchema` — validates cancellation (borrower address, signature)
- Signature inputs accept array `[r, s]`, JSON string, or `{r, s}` object format

**Signature Verification** — Server-side SNIP-12 signature verification (`src/lib/verify-signature.ts`):
- Reconstructs SNIP-12 typed data server-side and computes the message hash (prevents forged hashes)
- Calls `is_valid_signature(hash, signature)` on the signer's account contract via raw `starknet_call` RPC
- Follows SNIP-6 standard; returns the `'VALID'` shortstring (`0x56414c4944`) on success
- Works in Cloudflare Worker environment using only `fetch()` (no starknet.js Account needed)

### Off-Chain Signing Utilities

Off-chain SNIP-12 typed data functions are re-exported from `@fepvenancio/stela-sdk` via `src/lib/offchain.ts`:

```typescript
// Re-exports from SDK (source of truth — never duplicate these):
import {
  getInscriptionOrderTypedData,  // Build InscriptionOrder SNIP-12 typed data
  getLendOfferTypedData,          // Build LendOffer SNIP-12 typed data
  hashAssets,                     // Poseidon hash of asset arrays
} from '@/lib/offchain'

// App-local: CancelOrder typed data (not in SDK)
import { getCancelOrderTypedData } from '@/lib/offchain'
```

### Deployment
```bash
pnpm --filter web preview   # local preview in workerd
pnpm --filter web deploy    # deploy to Cloudflare Workers
```

### Environment Variables

Variables are set in `wrangler.jsonc` for production:
```json
"vars": {
  "NEXT_PUBLIC_NETWORK": "sepolia",
  "NEXT_PUBLIC_STELA_ADDRESS": "0x00c667d12113011a05f6271cc4bd9e7f4c3c5b90a093708801955af5a5b1e6d5",
  "NEXT_PUBLIC_RPC_URL": "https://api.cartridge.gg/x/starknet/sepolia"
}
```

---

## Service: indexer (Apibara DNA Streaming)

### Purpose
Stream StarkNet events from Apibara DNA via gRPC, transform and enrich them,
then POST to the CF Worker webhook for D1 persistence.

### Architecture
```
Apibara DNA (Sepolia gRPC) → [services/indexer] Node.js → HTTP POST → [workers/indexer] CF Worker → D1
```

### Stack
```
Node.js 22
@apibara/indexer + @apibara/starknet + @apibara/protocol (v2 beta)
starknet.js v6 (RPC enrichment: get_inscription, get_locker)
```

### Key Files
```
services/indexer/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── src/
    ├── index.ts          ← entry point: gRPC client + defineIndexer
    ├── transform.ts      ← event parsing + RPC enrichment → WebhookEvent[]
    ├── rpc.ts            ← SELECTORS, fetchInscriptionFromContract, fetchLockerAddress
    └── webhook.ts        ← POST webhook with retry + backoff
```

### Deployment
Deploy to Railway/Fly.io. Env vars: `DNA_TOKEN`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `RPC_URL`, `STELA_ADDRESS`.

## Worker: indexer (Webhook Receiver)

### Purpose
Receive pre-parsed events from the Apibara service via webhook and write to D1.
Also runs a cron to expire open inscriptions past their deadline.

### Stack
```
Cloudflare Worker + Cron Trigger (*/5 * * * *)
D1 via @stela/core createD1Queries
```

### How It Works
```
POST /webhook/events:
1. Authenticate with timing-safe Bearer token comparison
2. Validate payload (events array, block_number)
3. Idempotency: skip if block_number <= last_block
4. Process each event via handler dispatch (insert/update D1)
5. Advance cursor (setLastBlock)

GET /health:
Returns { ok: true, last_block } for Apibara service startup

scheduled():
Expire open inscriptions past deadline
```

### Key Files
```
workers/indexer/
├── wrangler.jsonc           ← D1 binding, cron trigger, WEBHOOK_SECRET
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts             ← fetch + scheduled handlers
    ├── types.ts             ← Env interface
    ├── schemas.ts           ← Zod validation schemas for webhook payloads
    └── handlers/index.ts    ← processWebhookEvent dispatcher
```

### Deployment
```bash
cd workers/indexer && pnpm wrangler deploy
```

---

## Worker: bot (Settlement & Liquidation)

### Purpose
Runs a cron every 2 minutes to perform three tasks in sequence:
1. **Expire stale orders** — mark off-chain orders past their deadline as expired
2. **Settle matched orders** — call `settle()` on-chain with both borrower + lender signatures
3. **Liquidate expired inscriptions** — call `liquidate()` on filled inscriptions past their duration

### Stack
```
Cloudflare Worker + Cron Trigger (*/2 * * * *)
starknet.js v9 (Account.execute)
D1 via @stela/core createD1Queries
```

### How It Works
```
scheduled() handler:
1. Acquire D1-based distributed lock (_meta table, key='bot_lock', 5 min TTL)
   - If lock held by another instance within the TTL window, skip this run
   - On completion (or error), release lock by resetting to '0'

2. Expire stale orders:
   queries.expireOrders(now) → updates orders past deadline to 'expired'

3. Settle matched orders:
   a. queries.getMatchedOrders() → returns [{order_id, offer_id}]
   b. For each matched pair:
      - Load order (order_data JSON) and offer from D1
      - Build settle() calldata: order struct (11 fields), serialized asset arrays
        (debt/interest/collateral with [len, ...per-asset fields]), borrower
        signature, offer struct (5 fields), lender signature
      - Account.execute({ entrypoint: 'settle', calldata })
      - On success: update both order and offer status to 'settled'
      - On failure: leave as 'matched' for retry on next cron run

4. Liquidate expired inscriptions:
   a. queries.findLiquidatable(now) → filled inscriptions where signed_at+duration < now
   b. For each → Account.execute({ entrypoint: 'liquidate', calldata: toU256(id) })

All operations are serialized within a single run to avoid StarkNet nonce conflicts.
```

### Order Status Transitions

```
pending → matched     (lender offer accepted via POST /api/orders/:id/offer)
matched → settled     (bot settles on-chain via settle() in cron)
pending → expired     (deadline passed, bot cron calls expireOrders)
pending → cancelled   (borrower signs cancellation via DELETE /api/orders/:id)
```

### D1 Distributed Lock

The bot uses the `_meta` table as a simple distributed lock to prevent overlapping cron runs:

```typescript
// Acquire: read 'bot_lock', skip if held within 300s (5 min TTL)
const lockValue = await queries.getMeta('bot_lock')
if (lockValue && now - Number(lockValue) < 300) return // skip

// Set lock with current timestamp
await queries.setMeta('bot_lock', String(now))

// ... do work ...

// Release lock (best-effort; TTL ensures expiry even on crash)
await queries.setMeta('bot_lock', '0')
```

### Secrets
Set via `wrangler secret put` (NOT in wrangler.jsonc):
```bash
cd workers/bot
wrangler secret put BOT_PRIVATE_KEY
wrangler secret put BOT_ADDRESS
wrangler secret put RPC_URL
```

### Deployment
```bash
cd workers/bot && pnpm deploy
```

**CRITICAL:** The bot wallet must hold enough ETH/STRK to pay gas. Never commit `BOT_PRIVATE_KEY`.

---

## Critical: u256 Handling

**u256 in Cairo = two felt252 values (low, high).** This applies everywhere:
inscription IDs, token amounts, share counts, percentages.

```typescript
import { toU256, fromU256, inscriptionIdToHex } from '@stela/core'

// bigint → [low, high] calldata pair
const calldata = toU256(BigInt('0x123'))  // ['0x123', '0x0']

// { low, high } → bigint
const value = fromU256({ low: 123n, high: 0n })  // 123n

// u256 → hex string (for DB keys)
const id = inscriptionIdToHex({ low: 123n, high: 0n })  // '0x0000...007b'
```

## StarkNet Event Parsing

Event fields are split between `keys[]` and `data[]` based on `kind` in the ABI:
- `keys[0]` = selector
- `keys[1..N]` = fields with `kind: "key"`
- `data[0..M]` = fields with `kind: "data"`
- **u256 = TWO slots** (low, high)
- **ContractAddress = ONE slot**

| Event | keys | data |
|-------|------|------|
| InscriptionCreated | [selector, id_low, id_high, creator] | [is_borrow] |
| InscriptionSigned | [selector, id_low, id_high, borrower, lender] | [pct_low, pct_high, shares_low, shares_high] |
| InscriptionCancelled | [selector, id_low, id_high] | [creator] |
| InscriptionRepaid | [selector, id_low, id_high] | [repayer] |
| InscriptionLiquidated | [selector, id_low, id_high] | [liquidator] |
| SharesRedeemed | [selector, id_low, id_high, redeemer] | [shares_low, shares_high] |

---

## What Goes Where

| Action | Where |
|--------|-------|
| Read inscription state | Direct contract read (`useContractRead`) |
| Read share balance | Direct contract read (`erc1155.balance_of`) |
| Browse/list inscriptions | Next.js API route → D1 |
| Portfolio / history | Next.js API route → D1 |
| Create, sign, repay, liquidate, redeem, cancel (on-chain) | Direct contract write via user wallet |
| Create off-chain order | Sign SNIP-12 off-chain → POST /api/orders |
| Submit lend offer | Sign SNIP-12 off-chain → POST /api/orders/:id/offer |
| Cancel off-chain order | Sign SNIP-12 off-chain → DELETE /api/orders/:id |
| Settle matched orders on-chain | Bot Worker calls `settle()` with both signatures |
| Auto-liquidate expired inscriptions | Bot Worker calls `liquidate()` |
| Expire stale off-chain orders | Bot Worker cron marks orders past deadline as expired |
| Index events from chain | Apibara service → webhook → Indexer Worker → D1 |

Never proxy on-chain writes through the backend. Users sign directly with their wallet.
Off-chain orders use SNIP-12 typed data signatures stored in D1, settled on-chain by the bot.

---

## After Creating/Updating Code

```bash
pnpm lint          # lint all packages
pnpm build         # build all packages
pnpm sync-abi      # if contracts changed
```

TypeScript strict mode is non-negotiable. No `any`. No `ts-ignore` without a comment explaining why.
