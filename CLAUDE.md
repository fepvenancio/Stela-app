# CLAUDE.md — Stela Monorepo Build Instructions

## Project Overview

Stela is a P2P lending/inscriptions protocol on StarkNet. The contracts are in a separate repo
(`stela-contracts/`). This repo contains everything else: frontend, indexer, and liquidation bot.

**Everything runs on Cloudflare:** Workers, D1 (SQLite), and OpenNext for the frontend.

Read this entire file before writing any code.

---

## Repo Structure

```
stela/                              ← this repo
├── packages/
│   └── core/                      ← shared types, ABI, constants, D1 queries
├── apps/
│   └── web/                       ← Next.js frontend (OpenNext → Cloudflare Workers)
├── workers/
│   ├── indexer/                   ← RPC polling cron Worker → D1
│   └── bot/                       ← liquidation cron Worker → StarkNet
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
- `_meta` — key/value store for indexer block cursor

Schema is in `packages/core/src/schema.sql`. Apply via:
```bash
wrangler d1 execute stela-db --file=packages/core/src/schema.sql
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
    │   ├── create/page.tsx
    │   ├── inscription/[id]/page.tsx
    │   ├── portfolio/page.tsx
    │   └── api/inscriptions/     ← D1 queries (server-side)
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
  "NEXT_PUBLIC_STELA_ADDRESS": "0x031f...",
  "NEXT_PUBLIC_RPC_URL": "https://rpc.starknet-testnet.lava.build"
}
```

---

## Worker: indexer (RPC Polling)

### Purpose
Poll StarkNet RPC for Stela contract events and write to D1.
This is the only way to enumerate inscriptions for browsing/discovery.

### Stack
```
Cloudflare Worker + Cron Trigger (*/1 * * * *)
starknet.js v6 (RpcProvider.getEvents)
D1 via @stela/core createD1Queries
```

### How It Works
```
scheduled() handler:
1. Read last_block from D1 _meta table
2. Cap range to MAX_BLOCK_RANGE (500) to avoid Worker timeout
3. provider.getEvents({ from_block, to_block, address, keys, chunk_size: 100 })
4. Handle pagination via continuation_token
5. For each event → route by selector to handler
6. Write to D1 via shared query module
7. Update last_block in _meta
```

### Key Files
```
workers/indexer/
├── wrangler.jsonc      ← D1 binding, cron trigger, nodejs_compat
├── package.json
├── tsconfig.json
└── src/index.ts        ← all logic in one file
```

### Deployment
```bash
cd workers/indexer && pnpm deploy
```

---

## Worker: bot (Liquidation)

### Purpose
Call `liquidate()` on inscriptions that have expired without repayment.

### Stack
```
Cloudflare Worker + Cron Trigger (*/2 * * * *)
starknet.js v6 (Account.execute)
D1 via @stela/core createD1Queries
```

### How It Works
```
scheduled() handler:
1. Query D1: inscriptions WHERE status='filled' AND signed_at+duration < now
2. For each → Account.execute({ entrypoint: 'liquidate', calldata: toU256(id) })
3. Serialize liquidations to avoid StarkNet nonce conflicts
```

### Secrets
Set via `wrangler secret put` (NOT in wrangler.jsonc):
```bash
cd workers/bot
wrangler secret put BOT_PRIVATE_KEY
wrangler secret put BOT_ADDRESS
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
| Create, sign, repay, liquidate, redeem, cancel | Direct contract write via user wallet |
| Auto-liquidate expired inscriptions | Bot Worker wallet |
| Index events from chain | Indexer Worker → D1 |

Never proxy writes through the backend. Users sign directly with their wallet.

---

## After Creating/Updating Code

```bash
pnpm lint          # lint all packages
pnpm build         # build all packages
pnpm sync-abi      # if contracts changed
```

TypeScript strict mode is non-negotiable. No `any`. No `ts-ignore` without a comment explaining why.
