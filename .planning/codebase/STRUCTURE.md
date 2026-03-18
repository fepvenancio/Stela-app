# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
stela-app/                              # Monorepo root
├── apps/
│   └── web/                            # Next.js 15 frontend (OpenNext → CF Workers)
│       ├── src/
│       │   ├── app/                    # App Router: pages + API routes
│       │   │   ├── api/                # BFF API routes (D1 direct access)
│       │   │   ├── borrow/             # Borrow flow page
│       │   │   ├── docs/               # Documentation page
│       │   │   ├── faq/                # FAQ page
│       │   │   ├── faucet/             # Testnet faucet page
│       │   │   ├── inscription/[id]/   # Inscription detail page
│       │   │   ├── markets/            # Markets listing page
│       │   │   ├── nft/                # NFT-related page
│       │   │   ├── order/[id]/         # Order detail page
│       │   │   ├── portfolio/          # Portfolio page
│       │   │   ├── privacy/            # Privacy policy page
│       │   │   ├── stela/              # Stela-specific page
│       │   │   ├── swap/               # Swap page
│       │   │   ├── terms/              # Terms of service page
│       │   │   ├── trade/              # Trade/order creation page
│       │   │   ├── layout.tsx          # Root layout (Providers, AppShell, TermsGate)
│       │   │   ├── page.tsx            # Home/landing page
│       │   │   └── providers.tsx       # StarknetConfig context provider
│       │   ├── components/             # Shared React components
│       │   │   ├── orderbook/          # Orderbook-specific components
│       │   │   ├── portfolio/          # Portfolio-specific components
│       │   │   ├── trade/              # Trade-specific components
│       │   │   └── ui/                 # shadcn/ui primitives
│       │   ├── hooks/                  # Custom React hooks
│       │   ├── lib/                    # Server + client utility modules
│       │   └── types/                  # Frontend-specific type declarations
│       ├── public/                     # Static assets
│       ├── wrangler.jsonc              # CF Workers config (D1 binding, env vars)
│       ├── open-next.config.ts         # OpenNext CF deployment config
│       ├── cloudflare-env.d.ts         # CloudflareEnv type (DB binding)
│       └── next.config.ts              # Next.js config
├── packages/
│   └── core/                           # Shared types, ABI, D1 queries, utilities
│       └── src/
│           ├── abi/stela.json          # Contract ABI (synced from contracts build)
│           ├── types.ts                # Core types: Inscription, Asset, WebhookEvent
│           ├── constants.ts            # STELA_ADDRESS, MAX_BPS, resolveNetwork
│           ├── u256.ts                 # bigint ↔ u256 felt pair conversion
│           ├── calldata.ts             # Asset calldata serialization + hashing
│           ├── tokens.ts               # Token registry (ERC20, NFT collections)
│           ├── d1.ts                   # createD1Queries factory (ALL D1 access)
│           ├── services/orders.ts      # processCreateOrder service logic
│           ├── schema.sql              # D1 main schema
│           ├── schema-orders.sql       # D1 orders/offers schema
│           ├── schema-listings.sql     # D1 listings schema
│           ├── schema-terms.sql        # D1 terms schema
│           └── index.ts               # Re-exports everything
├── services/
│   └── indexer/                        # Apibara DNA streaming service (Node.js, Railway)
│       └── src/
│           ├── index.ts               # Entry: gRPC stream client + defineIndexer + retry loop
│           ├── transform.ts           # Event parsing + RPC enrichment → WebhookEvent[]
│           ├── rpc.ts                 # SELECTORS, fetchInscriptionFromContract
│           └── webhook.ts             # POST webhook with retry + backoff
├── workers/
│   ├── indexer/                        # Webhook receiver CF Worker
│   │   └── src/
│   │       ├── index.ts               # fetch (webhook) + scheduled (expire + poll) handlers
│   │       ├── types.ts               # Env interface
│   │       ├── schemas.ts             # Zod schemas for webhook event data
│   │       ├── poll.ts                # RPC polling fallback (direct starknet_getEvents)
│   │       └── handlers/index.ts      # processWebhookEvent event dispatcher
│   └── bot/                            # Settlement + liquidation CF Worker
│       └── src/
│           └── index.ts               # scheduled handler: expire, settle, liquidate
├── scripts/
│   ├── sync-abi.mjs                    # Copy ABI from contracts build → packages/core
│   └── e2e-test.mjs                    # End-to-end test script
├── docs/                               # Project documentation
├── PRPs/                               # Product requirement proposals
├── work_logs/                          # Development work logs
├── package.json                        # Root package.json (pnpm workspace)
├── pnpm-workspace.yaml                 # Workspace package globs
├── turbo.json                          # Turborepo task pipeline
└── tsconfig.base.json                  # Base TypeScript config (extended by all packages)
```

## Directory Purposes

**`packages/core/src/`:**
- Purpose: Shared library imported by every app and worker
- Contains: Types, constants, D1 query factory, u256 helpers, token registry, calldata serializers, order service
- Key files: `d1.ts` (all database access), `types.ts` (core domain types), `calldata.ts` (StarkNet calldata), `services/orders.ts` (order creation logic)
- Rule: Never duplicate code from this package. Import from `@stela/core`.

**`apps/web/src/app/api/`:**
- Purpose: Next.js API routes — the BFF layer between frontend and D1
- Contains: Route handlers for all data operations (CRUD on inscriptions, orders, offers, shares)
- Key files: `orders/route.ts`, `inscriptions/route.ts`, `orders/[id]/offer/route.ts`
- Pattern: Every handler calls `getD1()` from `@/lib/api`, applies `rateLimit()`, validates with Zod

**`apps/web/src/hooks/`:**
- Purpose: All custom React hooks for chain interactions and API data fetching
- Contains: ~35 hooks covering wallet signing, contract calls, API reads, order management
- Key files: `useSignOrder.ts` (lender settle flow), `useCreateInscription.ts`, `useMultiSettle.ts`, `useOrderForm.ts`

**`apps/web/src/lib/`:**
- Purpose: Utility modules for both server (API routes) and client (hooks, components)
- Contains: API helper, rate limiting, schema validation, signature verification, nonce verification, formatting, tx helpers
- Key files: `api.ts` (CORS, rate limit, D1 helpers), `verify-signature.ts`, `verify-nonce.ts`, `offchain.ts`, `config.ts`

**`apps/web/src/components/`:**
- Purpose: Reusable React UI components
- Contains: Feature components + shadcn/ui primitives in `ui/`
- Key files: `AppShell.tsx` (nav/layout), `Web3ActionWrapper.tsx` (wallet connect gate), `TransactionProgressModal.tsx`

**`workers/indexer/src/handlers/`:**
- Purpose: Per-event-type D1 write handlers for the webhook receiver
- Contains: One handler per StarkNet event type (`handleCreated`, `handleSigned`, etc.)
- Key files: `index.ts` (the dispatcher + all handlers in one file)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: Root Next.js layout, wraps everything in providers
- `apps/web/src/app/providers.tsx`: StarkNet React config (chains, RPC, connectors)
- `services/indexer/src/index.ts`: Apibara stream entry point with infinite retry loop
- `workers/indexer/src/index.ts`: CF Worker fetch + scheduled handlers
- `workers/bot/src/index.ts`: Bot cron Worker — the sole file with all bot logic

**Configuration:**
- `apps/web/wrangler.jsonc`: Cloudflare deployment config for frontend (D1 binding, env vars, assets)
- `workers/indexer/wrangler.jsonc`: Indexer Worker deployment config
- `workers/bot/wrangler.jsonc`: Bot Worker deployment config
- `apps/web/src/lib/config.ts`: Runtime config constants (network, contract addresses, RPC URL)
- `tsconfig.base.json`: Base TypeScript strict config extended by all packages
- `turbo.json`: Build pipeline definition

**Core Logic:**
- `packages/core/src/d1.ts`: All D1 queries — the only place SQL is written
- `packages/core/src/services/orders.ts`: Order creation service (validation, sig verify, idempotency)
- `packages/core/src/u256.ts`: Cairo u256 ↔ bigint conversions (used in all calldata building)
- `apps/web/src/lib/api.ts`: API route helpers (getD1, jsonResponse, errorResponse, rateLimit, rateLimitWrite)
- `apps/web/src/lib/verify-signature.ts`: Server-side SNIP-12 signature verification
- `apps/web/src/lib/verify-nonce.ts`: On-chain nonce verification (fails closed)
- `apps/web/src/lib/offchain.ts`: Re-exports from `@fepvenancio/stela-sdk` for SNIP-12 typed data

**Testing:**
- `scripts/e2e-test.mjs`: End-to-end test script

## Naming Conventions

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `AppShell.tsx`, `TokenSelectorModal.tsx`)
- React hooks: camelCase prefixed with `use` (e.g., `useSignOrder.ts`, `useOrderForm.ts`)
- Server/utility modules: kebab-case (e.g., `verify-signature.ts`, `rate-limit.ts`, `order-utils.ts`)
- API route files: always `route.ts` (Next.js App Router convention)
- Worker entry points: always `index.ts`

**Directories:**
- App Router pages: kebab-case (e.g., `borrow/`, `order/`, `collateral-sales/`)
- Dynamic segments: `[id]/` pattern in brackets
- UI components: flat in `components/` with sub-dirs only for feature groups (`orderbook/`, `portfolio/`, `trade/`, `ui/`)

**Variables and Types:**
- Interfaces: PascalCase (e.g., `Inscription`, `WebhookEvent`, `D1Database`)
- Type aliases: PascalCase (e.g., `AssetType`, `InscriptionStatus`, `Network`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_BPS`, `STELA_ADDRESS`, `VALID_STATUSES`)
- Functions: camelCase (e.g., `createD1Queries`, `processWebhookEvent`, `toU256`)

## Where to Add New Code

**New API endpoint:**
- Create directory: `apps/web/src/app/api/<resource>/route.ts`
- Follow pattern in `apps/web/src/app/api/inscriptions/route.ts`
- Always apply `rateLimit(request)` at top of GET handlers
- Always apply `rateLimit(request, address)` + `rateLimitWrite(request, db, address)` for POST/DELETE
- Use `getD1()` from `@/lib/api` for D1 access

**New D1 query:**
- Add method to `packages/core/src/d1.ts` in the `createD1Queries` factory
- Add to `D1Queries` interface export
- Use prepared statements with `?` parameters only
- Re-export from `packages/core/src/index.ts` if needed by callers

**New React hook:**
- Add `use<Name>.ts` to `apps/web/src/hooks/`
- For wallet signing, use `useWalletSign` from `@/hooks/useWalletSign`
- For API reads, use `fetch()` with SWR-like pattern or extend `useInfiniteApi`

**New React component:**
- Feature components: `apps/web/src/components/<ComponentName>.tsx`
- Feature-group components: `apps/web/src/components/<group>/<ComponentName>.tsx`
- UI primitives (shadcn): `apps/web/src/components/ui/`

**New webhook event type:**
- Add event type to `WebhookEventType` union in `packages/core/src/types.ts`
- Add Zod schema to `workers/indexer/src/schemas.ts`
- Add handler function + case in `workers/indexer/src/handlers/index.ts`
- Add transform case in `services/indexer/src/transform.ts`

**New core utility:**
- Add to appropriate file in `packages/core/src/`
- Export from `packages/core/src/index.ts`

**New shared type:**
- Add to `packages/core/src/types.ts`
- Export from `packages/core/src/index.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: By `/gsd:map-codebase` command
- Committed: Yes

**`.forge/`:**
- Purpose: Forge worktrees for parallel task execution
- Generated: Yes (by Forge CI system)
- Committed: Partially (handoffs/reports yes, worktrees no)

**`.next/`, `.open-next/`:**
- Purpose: Next.js and OpenNext build output
- Generated: Yes
- Committed: No — must be deleted before redeployment to force fresh bundle

**`packages/core/dist/`:**
- Purpose: Compiled TypeScript output from `@stela/core`
- Generated: Yes (by `pnpm build` in core package)
- Committed: No

**`apps/web/src/components/ui/`:**
- Purpose: shadcn/ui component primitives
- Generated: Partially (shadcn CLI scaffolds initial files, then customized)
- Committed: Yes

---

*Structure analysis: 2026-03-18*
