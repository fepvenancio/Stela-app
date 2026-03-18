# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**StarkNet RPC:**
- Cartridge RPC (default) - `https://api.cartridge.gg/x/starknet/sepolia` (or `/mainnet`)
  - Used by: frontend provider (`apps/web/src/app/providers.tsx`), server-side signature verification (`apps/web/src/lib/verify-signature.ts`), and the Apibara indexer service for contract enrichment reads (`services/indexer/src/rpc.ts`)
  - Auth: none (public endpoint); Alchemy is used for the bot (has API key in `RPC_URL` secret)
- Alchemy RPC (bot) - endpoint set via `workers/bot` secret `RPC_URL`; required for V3 transaction support with starknet.js v9

**Apibara DNA gRPC Stream:**
- Service: Apibara DNA StarkNet stream (Sepolia)
  - SDK: `@apibara/indexer`, `@apibara/starknet`, `@apibara/protocol` (all v2.0.0-beta.0)
  - Entry: `services/indexer/src/index.ts`
  - Auth: Bearer token via `DNA_TOKEN` env var; passed as gRPC metadata
  - Stream URL: set via `DNA_STREAM_URL` env var
  - Purpose: Receive StarkNet events from the Stela contract in real-time

**Alchemy NFT API:**
- Endpoint: `https://starknet-sepolia.g.alchemy.com/nft/v3` (or mainnet)
  - Configured in: `apps/web/src/lib/config.ts` as `ALCHEMY_NFT_BASE`
  - Auth: `ALCHEMY_API_KEY` — Cloudflare Worker secret accessed via `getCloudflareContext()`
  - Used by: `apps/web/src/app/api/nft/owned/[owner]/route.ts` and related NFT API routes
  - Purpose: Fetch NFT ownership and metadata (used for Genesis NFT display)

**Google Analytics:**
- Tag: `G-L2HFJTLWB6` (set in `apps/web/wrangler.jsonc` as `NEXT_PUBLIC_GA_ID`)
- Integration: `@next/third-parties/google` `<GoogleAnalytics>` component in `apps/web/src/app/layout.tsx`
- CSP allows: `https://www.google-analytics.com`, `https://www.googletagmanager.com`

**Voyager Block Explorer:**
- Mainnet: `https://voyager.online/tx`
- Sepolia: `https://sepolia.voyager.online/tx`
- Used for transaction links; configured in `apps/web/src/lib/config.ts`

## Data Storage

**Databases:**
- Cloudflare D1 (SQLite)
  - Name: `stela-db`
  - ID: `e8633170-f033-4e41-8c45-ab59f07d4006`
  - Binding: `DB` (in all three `wrangler.jsonc` files)
  - Client: `createD1Queries(env.DB)` from `packages/core/src/d1.ts`
  - Used by: `apps/web/` API routes (via `getD1()` in `src/lib/api.ts`), `workers/indexer/`, `workers/bot/`
  - Schema files:
    - `packages/core/src/schema.sql` — inscriptions, inscription_assets, inscription_events, lockers, share_balances, _meta
    - `packages/core/src/schema-orders.sql` — orders, order_offers, collection_offers, collection_offer_acceptances, refinance_offers, refinance_approvals, renegotiations, collateral_sales

**File Storage:**
- None — no external file storage (assets are on-chain)

**Caching:**
- None — no Redis or KV caching layer; in-memory rate-limit store only (per-worker instance, resets on cold start)

## Authentication & Identity

**Wallet Connectors (frontend):**
- Argent wallet — via `argent()` from `@starknet-react/core`
- Braavos wallet — via `braavos()` from `@starknet-react/core`
- Cartridge Controller — via `ControllerConnector` from `@cartridge/connector`; supports passkey/social login and pre-approved session keys
- Connector list defined in `apps/web/src/lib/connectors.ts`; session policies cover all Stela contract entrypoints plus ERC20 `approve` for all known tokens

**Server-side Signature Verification:**
- Implementation: `apps/web/src/lib/verify-signature.ts`
- Method: Raw `starknet_call` JSON-RPC to invoke `is_valid_signature(hash, [r, s])` on the signer's account contract (SNIP-6 standard)
- Called for: order creation (`POST /api/orders`), lend offers (`POST /api/orders/:id/offer`), order cancellation (`DELETE /api/orders/:id`)
- Timeout: 15 seconds per call
- Returns: `true` if contract returns `0x56414c4944` ("VALID" shortstring)

**Nonce Verification:**
- Implementation: `apps/web/src/lib/verify-nonce.ts`
- Reads `nonces(address)` from the Stela contract; fails closed if RPC is unavailable

**Bot Authentication:**
- `workers/bot/` uses `Account` from starknet.js v9 with `BOT_PRIVATE_KEY` and `BOT_ADDRESS` secrets
- No user-facing auth on the bot Worker (only exposes a health `fetch()` handler returning 200)

**Webhook Authentication (indexer):**
- `workers/indexer/` verifies incoming webhook POSTs with timing-safe Bearer token comparison
- Secret: `WEBHOOK_SECRET` (set via `wrangler secret put` on the indexer worker)
- The Apibara service (`services/indexer/`) sends the same secret in the `Authorization: Bearer` header

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar service integrated)

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout all packages
- Cloudflare Workers logs available via `wrangler tail` or the Cloudflare dashboard
- Railway dashboard for the Apibara indexer service logs

**Analytics:**
- Google Analytics 4 via `@next/third-parties/google` (frontend only, tag `G-L2HFJTLWB6`)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers — `apps/web/` (stela-app), `workers/indexer/` (stela-indexer), `workers/bot/` (stela-bot)
- Custom domains: `stela-dapp.xyz`, `www.stela-dapp.xyz` (configured in `apps/web/wrangler.jsonc` routes)
- Railway or Fly.io — `services/indexer/` (Apibara DNA streaming, Node.js 22, Dockerfile present)

**CI Pipeline:**
- Not detected (no `.github/workflows/` or similar CI config found)

**Deploy commands:**
```bash
# Web app (must use deploy, NOT just build)
cd apps/web && pnpm run deploy   # runs opennextjs-cloudflare build && deploy

# Workers (use npx wrangler@3 on macOS to avoid arch issues)
cd workers/bot && npx wrangler@3 deploy
cd workers/indexer && npx wrangler@3 deploy
```

## Environment Configuration

**Required env vars:**

| Service | Variable | Secret |
|---------|----------|--------|
| `stela-app` (web) | `NEXT_PUBLIC_STELA_ADDRESS` | No |
| `stela-app` (web) | `NEXT_PUBLIC_NETWORK` | No |
| `stela-app` (web) | `NEXT_PUBLIC_RPC_URL` | No |
| `stela-app` (web) | `NEXT_PUBLIC_GA_ID` | No |
| `stela-app` (web) | `ALCHEMY_API_KEY` | Yes (wrangler secret) |
| `stela-bot` | `STELA_ADDRESS` | No |
| `stela-bot` | `BOT_PRIVATE_KEY` | Yes |
| `stela-bot` | `BOT_ADDRESS` | Yes |
| `stela-bot` | `RPC_URL` | Yes |
| `stela-indexer` | `STELA_ADDRESS` | No |
| `stela-indexer` | `WEBHOOK_SECRET` | Yes |
| `services/indexer` | `DNA_TOKEN` | Yes |
| `services/indexer` | `DNA_STREAM_URL` | Yes |
| `services/indexer` | `WEBHOOK_URL` | No |
| `services/indexer` | `WEBHOOK_SECRET` | Yes (must match worker) |
| `services/indexer` | `RPC_URL` | Yes |
| `services/indexer` | `STELA_ADDRESS` | No |

**Secrets location:**
- Cloudflare Worker secrets: `wrangler secret put <NAME>` (stored in Cloudflare, not in repo)
- Railway env vars: set in Railway dashboard

## Webhooks & Callbacks

**Incoming (to `workers/indexer/`):**
- `POST /webhook/events` — Receives pre-parsed event batches from the Apibara Node.js service
  - Auth: Bearer token (timing-safe comparison against `WEBHOOK_SECRET`)
  - Payload: `{ block_number, events: WebhookEvent[], cursor }` (see `packages/core/`)
  - Idempotency: skips blocks already processed (block_number <= last_block in `_meta`)
- `GET /health` — Returns `{ ok: true, last_block }` for the Apibara service to find its resume point

**Outgoing (from `services/indexer/`):**
- `POST {WEBHOOK_URL}/webhook/events` — Sends processed events to the CF indexer worker
  - Retry: up to 3 attempts with exponential backoff; 4xx errors (except 429) are not retried
  - Implementation: `services/indexer/src/webhook.ts`

**On-chain interactions (from `workers/bot/`):**
- Calls `settle()` on the Stela contract to settle matched orders
- Calls `liquidate()` on the Stela contract to liquidate expired inscriptions
- Uses starknet.js v9 `Account.execute()` with the bot's private key
- Cron trigger: every 2 minutes (`*/2 * * * *`)

**On-chain interactions (from `apps/web/` via user wallet):**
- All on-chain writes (sign, repay, cancel, redeem, liquidate, etc.) go directly from the user's browser wallet — never proxied through the backend

## Smart Contracts

**Stela Protocol (StelaProtocol):**
- Address (Sepolia): `0x0109c6caae0c5b4da6e063ed6c02ae784be05aa90806501a48dcfbb213bd7c03`
- ABI: `packages/core/src/abi/stela.json` (synced via `pnpm sync-abi`)
- Key entrypoints: `settle`, `liquidate`, `sign_inscription`, `fill_signed_order`, `cancel_inscription`, `repay`, `redeem`, `batch_redeem`, `nonces`, `refinance`, `settle_collection`, `commit_renegotiation`, `execute_renegotiation`, `buy_collateral`, `start_auction`, `bid`, `claim_collateral`

**StelaGenesis (ERC721 NFT):**
- Address (Sepolia): `0x0265ea52ffbf1b7e1a029b94fe1a2023899dd0bc02eb1f11c9b04ea90e957d28`
- ABI: `packages/core/src/abi/genesis.json`
- Key entrypoints: `mint`, `mint_batch`, `set_approval_for_all`

**Known token addresses used:**
- STRK: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`
- ETH: `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`
- Full token registry: `@fepvenancio/stela-sdk` via `getTokensForNetwork(NETWORK)`

---

*Integration audit: 2026-03-18*
