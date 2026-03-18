# Architecture — Stela App

## Stack
- Next.js 15 (App Router), React 19, Tailwind CSS 4
- Cloudflare D1 (SQLite), Workers, Cron Triggers
- StarkNet (Sepolia) via @starknet-react/core
- @fepvenancio/stela-sdk for protocol logic
- Radix UI + CVA for components

## Monorepo Layout
```
apps/web/          — Next.js frontend + API routes
packages/core/     — Shared types, ABI, D1 queries, constants
workers/bot/       — Cron settlement + liquidation (starknet v9)
workers/indexer/   — Webhook receiver + expiry cron
services/indexer/  — Apibara DNA gRPC streaming
```

## Architectural Invariants
1. API routes validate input with Zod — no raw user data passes through
2. No direct D1 calls from components — all go through API routes or hooks
3. All state mutations go through @tanstack/react-query invalidation
4. No `any` type — TypeScript strict mode everywhere
5. Credentials from environment only (wrangler secrets)
6. No raw SQL — all queries use prepared statements with `?`
7. SNIP-12 signature verification on server for all signed operations
8. Rate limiting: 60/min read, 10/min write per IP

## Data Flow
```
StarkNet → Apibara DNA → services/indexer → workers/indexer → D1
D1 → API routes → React Query hooks → UI components
User action → Wallet sign → API → D1 → Bot settle → StarkNet
```

## Key Pages
- `/markets` — Pair discovery, volume stats, NFT collection offers
- `/markets/[pair]` — Orderbook view with APR, best yield, batch ops
- `/trade` — Order creation (borrow/lend/collection), match detection
- `/browse` — Browse inscriptions + off-chain orders
- `/portfolio` — User positions dashboard
