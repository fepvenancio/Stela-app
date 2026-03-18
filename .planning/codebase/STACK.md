# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.7 - All packages, apps, workers, and services; strict mode enforced everywhere

**Secondary:**
- SQL (SQLite dialect) - D1 schema files at `packages/core/src/schema.sql` and `packages/core/src/schema-orders.sql`

## Runtime

**Environment:**
- Cloudflare Workers (`workerd`) - frontend (via OpenNext), indexer worker, bot worker
- Node.js 22 - Apibara indexer service (`services/indexer/`) deployed to Railway/Fly.io

**Package Manager:**
- pnpm 10.28.0
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core:**
- Next.js 15.2 (`apps/web/`) - App Router, deployed to Cloudflare Workers via OpenNext
- `@opennextjs/cloudflare` 1.0 - Adapter that bundles Next.js for Cloudflare Workers runtime

**Build:**
- Turborepo 2.4 - Monorepo build orchestration (`turbo.json`); tasks: `build`, `dev`, `lint`, `deploy`
- TypeScript compiler (`tsc`) - Used by `@stela/core` for library build to `dist/`

**Config:**
- Target: ES2022; module: ESNext; moduleResolution: bundler (`tsconfig.base.json`)
- `isolatedModules: true`, `strict: true`, `declaration: true`, `declarationMap: true`

## Key Dependencies

**StarkNet interaction:**
- `starknet` 6.23.1 - Used in `apps/web/`, `packages/core/`, and `services/indexer/` for RPC, typed data
- `starknet` 9.2.1 - Used in `workers/bot/` for `Account.execute()` (V3 transaction support)
- `@starknet-react/core` 3.7.0 - React hooks for contract reads/writes in frontend
- `@starknet-react/chains` 3.1.0 - Chain definitions (sepolia, mainnet)
- `get-starknet-core` 4.0.0 - Low-level wallet connector interface

**SDK:**
- `@fepvenancio/stela-sdk` 0.10+ - Source of truth for SNIP-12 typed data builders, asset hashing, token registry, position valuation math

**Wallet connectors:**
- `@cartridge/connector` 0.8.0 - Cartridge Controller (passkey/social login, session keys)
- `@cartridge/controller` 0.8.0 - Controller internals
- `@cartridge/presets` 0.5.2 - Session policy types
- Argent and Braavos via `@starknet-react/core` built-ins

**Apibara (indexer service):**
- `@apibara/indexer` 2.0.0-beta.0 - DNA stream indexer framework
- `@apibara/starknet` 2.0.0-beta.0 - StarkNet stream adapter
- `@apibara/protocol` 2.0.0-beta.0 - gRPC client protocol
- `nice-grpc-common` 2.0.2 - gRPC metadata utilities

**UI:**
- React 19.0
- Tailwind CSS 4.0 (with `@tailwindcss/postcss`)
- `radix-ui` 1.4.3 - Headless UI primitives
- `lucide-react` 0.575 - Icon library
- `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.5 - Class name utilities
- `next-themes` 0.4.6 - Theme management
- `sonner` 2.0.7 - Toast notifications

**Data fetching:**
- `@tanstack/react-query` 5.90 - Server state management on the frontend

**Validation:**
- `zod` 4.3.6 - Used in `apps/web/` API routes and `workers/indexer/` webhook validation
- `zod` 3.24.2 - Used in `packages/core/` (separate version due to workspace isolation)

**Shared internal:**
- `@stela/core` (workspace) - Imported by all workers, the web app, and the indexer service; provides D1 query module, types, ABI, constants, u256 utilities

## Configuration

**Environment (production):**
- `apps/web/wrangler.jsonc` - `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_STELA_ADDRESS`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_GA_ID`
- `workers/bot/wrangler.jsonc` - `STELA_ADDRESS` (public); `BOT_PRIVATE_KEY`, `BOT_ADDRESS`, `RPC_URL` via `wrangler secret put`
- `workers/indexer/wrangler.jsonc` - `STELA_ADDRESS` (public); `WEBHOOK_SECRET` via `wrangler secret put`
- `services/indexer/` - `.env.example` for `DNA_TOKEN`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `RPC_URL`, `STELA_ADDRESS`, `DNA_STREAM_URL`

**Local development:**
- `apps/web/.env.local` - `NEXT_PUBLIC_STELA_ADDRESS`, `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_RPC_URL`

**Build:**
- `apps/web/next.config.ts` - transpiles `@stela/core`, externalizes `ws`, sets security headers and cache policy
- `apps/web/open-next.config.ts` - minimal `defineCloudflareConfig()` call
- `apps/web/postcss.config.mjs` - PostCSS for Tailwind v4

**Compatibility:**
- All Cloudflare Workers use `"compatibility_date": "2025-04-01"` and `"compatibility_flags": ["nodejs_compat"]`
- `workerd` 1.20260228.1 dev dependency in `apps/web/` for local preview

## Platform Requirements

**Development:**
- pnpm 10.28+ required
- Node.js 22 for the Apibara indexer service
- Wrangler 4.x for Cloudflare Workers deployment
- `CLOUDFLARE_ACCOUNT_ID` env var for D1 operations

**Production:**
- Cloudflare Workers (stela-app, stela-indexer, stela-bot)
- Cloudflare D1 (database ID: `e8633170-f033-4e41-8c45-ab59f07d4006`)
- Railway or Fly.io for the Node.js Apibara indexer service
- Bot worker requires a funded StarkNet wallet (ETH/STRK for gas)

---

*Stack analysis: 2026-03-18*
