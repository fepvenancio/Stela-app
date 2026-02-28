# Stela

P2P lending protocol on StarkNet. Borrowers inscribe collateral, lenders fund loans, and settlement happens on-chain with optional privacy via zero-knowledge proofs.

This monorepo contains the full application stack: a Next.js frontend, Cloudflare Workers for indexing and automated settlement/liquidation, and shared protocol types.

**Live:** [stela-dapp.xyz](https://stela-dapp.xyz) (StarkNet Sepolia testnet)

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4, deployed via OpenNext on Cloudflare Workers
- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Indexing:** Apibara DNA (gRPC event streaming) + webhook receiver Worker
- **Build:** Turborepo, pnpm workspaces, TypeScript strict mode
- **Blockchain:** StarkNet (starknet.js v6 for frontend, v9 for bot)
- **Wallets:** Argent X, Braavos (via @starknet-react/core)

## Repository Structure

```
stela-app/
├── apps/
│   └── web/                  Next.js frontend + API routes (D1 direct access)
├── packages/
│   └── core/                 Shared types, ABI, constants, D1 query module
├── workers/
│   ├── indexer/              Webhook receiver Worker + cron expiry
│   └── bot/                  Settlement + liquidation cron Worker
├── services/
│   └── indexer/              Apibara DNA streaming service (Node.js)
├── scripts/                  ABI sync and e2e test scripts
└── docs/                     Architecture, frontend, and deployment docs
```

### Package Details

| Package | Name | Description |
|---|---|---|
| `apps/web` | `web` | Next.js 15 frontend with API routes that query D1 directly. Browse inscriptions, create orders, manage portfolio, lend, repay, redeem. |
| `packages/core` | `@stela/core` | Shared types (`Inscription`, `Asset`, `InscriptionStatus`), contract ABI, D1 query module (`createD1Queries`), u256 helpers, token registry, constants. |
| `workers/indexer` | `stela-indexer` | Cloudflare Worker that receives webhook events from the Apibara service, validates with Zod, writes to D1. Cron trigger expires stale inscriptions every 5 minutes. |
| `workers/bot` | `stela-bot` | Cloudflare Worker that runs every 2 minutes to: expire stale off-chain orders, settle matched orders on-chain, and liquidate expired inscriptions. Uses a D1-based distributed lock. |
| `services/indexer` | `stela-apibara-indexer` | Long-running Node.js process that streams StarkNet events via Apibara DNA gRPC, enriches them with RPC calls, and POSTs webhooks to the indexer Worker. |

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10.28.0 (`corepack enable` to activate)
- **Cloudflare account** with Workers and D1 access
- **Wrangler CLI** (included as devDependency)

For the Apibara indexer service:
- **Apibara DNA token**
- **StarkNet RPC endpoint** (e.g., Cartridge, Alchemy)

For the bot worker:
- **Bot wallet** funded with ETH/STRK for gas on Sepolia

## Getting Started

```bash
git clone https://github.com/fepvenancio/stela-app.git
cd stela-app
pnpm install
```

### Development

Start all services in parallel:

```bash
pnpm dev
```

This runs via Turborepo:
- `apps/web` -- Next.js dev server
- `workers/indexer` -- Wrangler local Worker
- `workers/bot` -- Wrangler local Worker
- `services/indexer` -- tsx watch mode

### Build

```bash
pnpm build    # Build all packages in dependency order
pnpm lint     # TypeScript strict mode check across all packages
```

### ABI Sync

If the Cairo contracts have been updated, sync the ABI:

```bash
pnpm sync-abi
```

## Environment Setup

### Frontend (`apps/web`)

Variables are set in `apps/web/wrangler.jsonc` under `vars`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_NETWORK` | StarkNet network (`sepolia` or `mainnet`) |
| `NEXT_PUBLIC_STELA_ADDRESS` | Stela contract address |
| `NEXT_PUBLIC_RPC_URL` | StarkNet RPC endpoint |

### Workers

Workers use `.dev.vars` files for local secrets (gitignored):

```bash
cp workers/indexer/.dev.vars.example workers/indexer/.dev.vars
cp workers/bot/.dev.vars.example workers/bot/.dev.vars
```

Secrets for production are set via Wrangler:

```bash
# Indexer Worker
cd workers/indexer && npx wrangler secret put WEBHOOK_SECRET

# Bot Worker
cd workers/bot
npx wrangler secret put BOT_PRIVATE_KEY
npx wrangler secret put BOT_ADDRESS
npx wrangler secret put RPC_URL
```

### Apibara Indexer Service (`services/indexer`)

```bash
cd services/indexer && cp .env.example .env
```

Required env vars: `DNA_TOKEN`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `RPC_URL`, `STELA_ADDRESS`.

## Database Setup

Create the D1 database (first time only):

```bash
npx wrangler d1 create stela-db
```

Update the `database_id` in all `wrangler.jsonc` files, then apply the schema:

```bash
npx wrangler d1 execute stela-db --file=packages/core/src/schema.sql
npx wrangler d1 execute stela-db --file=packages/core/src/schema-orders.sql
```

For local development, add `--local`:

```bash
npx wrangler d1 execute stela-db --local --file=packages/core/src/schema.sql
npx wrangler d1 execute stela-db --local --file=packages/core/src/schema-orders.sql
```

## Deployment

### Frontend

```bash
pnpm --filter web preview    # Local preview in workerd
pnpm --filter web deploy     # Deploy to Cloudflare Workers
```

### Indexer Worker

```bash
cd workers/indexer && pnpm deploy
```

### Bot Worker

```bash
cd workers/bot && pnpm deploy
```

The bot wallet must hold enough ETH/STRK to pay gas. Never commit `BOT_PRIVATE_KEY`.

### Apibara Indexer Service

Deploy to Railway, Fly.io, or any container platform:

```bash
docker build -f services/indexer/Dockerfile -t stela-indexer .
docker run --env-file services/indexer/.env stela-indexer
```

## How It Works

### On-Chain Flow

Users interact directly with the StarkNet contract via their wallet:

1. **Borrower** creates an inscription with collateral, specifying debt and interest terms
2. **Lender** signs the inscription, funding the loan
3. **Borrower** repays debt + interest before the deadline
4. **Lender** redeems shares to claim repaid assets (or liquidated collateral if expired)

### Off-Chain Order Flow

The protocol supports gasless order creation via SNIP-12 typed data signatures:

1. **Borrower** signs an `InscriptionOrder` off-chain (no gas) and posts it to the API
2. **Lender** signs a `LendOffer` and submits it as an offer
3. The **bot worker** picks up matched orders and settles them on-chain with both signatures

### Privacy Pool

Lenders can opt into private lending by generating a commitment hash. When an order with a `lender_commitment` is settled:

- Shares are committed to a Merkle tree in the privacy pool (instead of minting visible ERC1155 tokens)
- Lenders redeem privately using a ZK proof via the `private_redeem` entrypoint
- Private notes (salt, commitment, nullifier) are stored in the browser's localStorage

## Related Repositories

| Repository | Description |
|---|---|
| [fepvenancio/Stela](https://github.com/fepvenancio/Stela) | Cairo smart contracts |
| [fepvenancio/stela-sdk-ts](https://github.com/fepvenancio/stela-sdk-ts) | TypeScript SDK (`@fepvenancio/stela-sdk` on npm) |
| [fepvenancio/stela-privacy](https://github.com/fepvenancio/stela-privacy) | Privacy pool contracts (commitment tree, shielded pool, ZK verifier) |

## Documentation

Detailed documentation is in the `docs/` directory:

- [Architecture](docs/architecture.md) -- System architecture, data flow, Cloudflare stack
- [Frontend](docs/frontend.md) -- Pages, components, hooks, state management
- [Deployment](docs/deployment.md) -- Full deployment guide with secret management

## License

All rights reserved.
