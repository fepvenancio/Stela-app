# Codebase Concerns

**Analysis Date:** 2026-03-18

---

## Security Considerations

**T1 Write Endpoints Accept Signatures Without Server-Side Verification:**
- Risk: Anyone can POST forged collection offers, refinance offers, renegotiations, and collateral sales to D1 by supplying any StarkNet address as the signer. The signature stored in D1 is never verified server-side on creation.
- Files: `apps/web/src/app/api/collection-offers/route.ts`, `apps/web/src/app/api/refinances/route.ts`, `apps/web/src/app/api/renegotiations/route.ts`, `apps/web/src/app/api/collateral-sales/route.ts`
- Current mitigation: Zod validates field formats; rate limiting (IP + D1-backed) prevents mass spam. The signature itself is passed through without `verifyStarknetSignature` being called.
- Contrast: `POST /api/orders` and `POST /api/orders/:id/offer` both call `verifyStarknetSignature` and `verifyNonce` before writing. The T1 routes do not.
- Recommendations: Add `verifyStarknetSignature` + `verifyNonce` calls to all T1 POST routes, mirroring the pattern in `apps/web/src/app/api/orders/route.ts`.

**T1 Cancel Endpoints Use Address-Only Auth (No Signature):**
- Risk: DELETE on collection offers, refinances, renegotiations, and collateral sales only verifies the caller owns the address by checking it matches the stored owner field. No cryptographic proof of control.
- Files: `apps/web/src/app/api/collection-offers/[id]/route.ts`, `apps/web/src/app/api/refinances/[id]/route.ts`, `apps/web/src/app/api/renegotiations/[id]/route.ts`, `apps/web/src/app/api/collateral-sales/[id]/route.ts`
- Current mitigation: Rate limiting; address must match the stored lender/proposer/buyer. But no SNIP-12 signature is required.
- Contrast: `DELETE /api/orders/:id` requires a CancelOrder typed data signature verified on-chain via `verifyStarknetSignature`.
- Recommendations: Add SNIP-12 cancel typed data + `verifyStarknetSignature` to all T1 cancel endpoints.

**Share Listing Fill Endpoint — No On-Chain Transaction Verification:**
- Risk: `POST /api/share-listings/:id` (fill) accepts any `tx_hash` from the buyer without verifying the transaction actually transferred shares. A buyer can mark a listing as filled without paying.
- Files: `apps/web/src/app/api/share-listings/[id]/route.ts` (lines 77-107)
- Current mitigation: Rate limiting; buyer must exist and listing must be active. `tx_hash` is stored but not verified.
- Recommendations: Add `verifySettleTransaction`-style RPC verification that the `tx_hash` contains a `TransferSingle` event from the seller to the buyer for the correct listing.

**ALCHEMY_API_KEY Not Declared in `wrangler.jsonc`:**
- Risk: `ALCHEMY_API_KEY` is referenced in four NFT API routes via `env.ALCHEMY_API_KEY`, declared in `cloudflare-env.d.ts`, but absent from `wrangler.jsonc` vars. The key must be set via `wrangler secret put`. If not set, all `/api/nft/*` routes return 503.
- Files: `apps/web/src/app/api/nft/token/[address]/[tokenId]/route.ts`, `apps/web/src/app/api/nft/contract/[address]/route.ts`, `apps/web/src/app/api/nft/collection/[address]/route.ts`, `apps/web/src/app/api/nft/owned/[owner]/route.ts`
- Current mitigation: Routes return 503 with "NFT API not configured" on missing key — fails closed correctly.
- Recommendations: Document `wrangler secret put ALCHEMY_API_KEY` in CLAUDE.md and deployment checklist. `wrangler.jsonc` has no comment indicating the key must be a secret.

---

## Tech Debt

**`packages/core/src/d1.ts` is 1,901 Lines — Monolithic Query Module:**
- Issue: All D1 queries for every domain (inscriptions, orders, offers, collection offers, refinances, renegotiations, collateral sales, share listings, share balances, lockers, rate limiting, distributed locking) are in a single 1,901-line file.
- Files: `packages/core/src/d1.ts`
- Impact: High merge conflict probability; hard to navigate; difficult to understand which queries belong to which feature. Adding new domains continues to grow the file.
- Fix approach: Split into domain modules (`d1/inscriptions.ts`, `d1/orders.ts`, `d1/t1.ts`, etc.) and re-export from `d1/index.ts`. Maintain the `createD1Queries` factory interface so callers don't change.

**`apps/web/src/app/trade/page.tsx` is 1,946 Lines — God Component:**
- Issue: The trade page is a 1,946-line single React component handling lend forms, borrow forms, collection offer flows, multi-settle, NFT token picking, settlement drawers, fee breakdowns, match detection, and more.
- Files: `apps/web/src/app/trade/page.tsx`
- Impact: Two `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions indicate hook dependency problems. Very difficult to test, maintain, or extend safely.
- Fix approach: Extract sub-flows (borrow form, lend form, collection offer flow) into dedicated page components or route segments. The `apps/web/src/app/borrow/` partial extraction is already started.

**In-Memory Rate Limiter Uses `setInterval` in Cloudflare Workers:**
- Issue: `apps/web/src/lib/rate-limit.ts` registers a `setInterval` cleanup at module load. Cloudflare Workers do not persist between requests in the same process — `setInterval` never fires across isolate recycling, meaning memory is cleaned up only within a single isolate's lifetime, not globally.
- Files: `apps/web/src/lib/rate-limit.ts`
- Impact: Not a correctness bug (memory is bounded per isolate), but the cleanup interval is misleading. The in-memory stores `readStore`, `writeStore`, `addressStore` only live per-isolate, so rate limits reset on cold starts.
- Fix approach: The D1-backed rate limiter (`checkWriteRateLimit` in `packages/core/src/d1.ts`) already handles the persistent case. The in-memory limiter's role should be documented as "fast first line of defense within an isolate's lifetime." Remove the misleading `setInterval`.

**Hardcoded RPC URL in `workers/indexer/src/poll.ts`:**
- Issue: The fallback RPC polling path in `workers/indexer/src/poll.ts` hardcodes `https://api.cartridge.gg/x/starknet/sepolia` at line 13. This is not injected from `env`, meaning it always targets Sepolia even if the worker is redeployed for mainnet.
- Files: `workers/indexer/src/poll.ts`
- Impact: If/when Stela deploys to mainnet, the polling fallback will silently index the wrong network.
- Fix approach: Add `RPC_URL` to the indexer worker's `Env` interface (`workers/indexer/src/types.ts`) and inject it via `wrangler.jsonc vars` or `wrangler secret put`.

**Hardcoded Event Selectors in `workers/indexer/src/poll.ts`:**
- Issue: `EVENT_SELECTORS` are hardcoded hex strings at lines 100-109 with a comment noting they were computed from `starknet.js`. If the contract ABI changes and event signatures change, the poll fallback silently drops events.
- Files: `workers/indexer/src/poll.ts`
- Impact: Silent indexing failures after any ABI upgrade that renames events.
- Fix approach: Import selectors from `@stela/core` or derive them from the stored ABI at startup, so ABI sync (`pnpm sync-abi`) propagates to the poll path automatically.

**Duplicated JSON.parse Pattern Across Frontend Pages:**
- Issue: Five frontend pages independently implement `try { return JSON.parse(order.order_data) } catch { return {} }` as an inline IIFE when rendering order data. This pattern is copy-pasted without a shared utility.
- Files: `apps/web/src/app/order/[id]/page.tsx:52`, `apps/web/src/app/trade/page.tsx:1445`, `apps/web/src/app/markets/[pair]/page.tsx:171`, `apps/web/src/app/portfolio/page.tsx:80`, `apps/web/src/app/stela/[id]/page.tsx:106`
- Impact: Silent failure mode — on parse error, an empty object `{}` is used as order data, causing rendering bugs that are hard to detect.
- Fix approach: Extract `parseOrderData(raw: unknown): OrderData | null` into `apps/web/src/lib/order-utils.ts` and return `null` on failure so callers render a clear error state instead of silently degrading.

**`logError` Suppresses Error Messages in Production:**
- Issue: `apps/web/src/lib/api.ts` `logError()` logs only `[ErrorName]` or `[unknown error]` to prevent schema leakage. This makes debugging production incidents extremely difficult — the actual D1 error message, query, or RPC failure is never visible in Cloudflare logs.
- Files: `apps/web/src/lib/api.ts:72-78`
- Impact: When D1 queries fail in production, the only log entry is e.g. `orders: [Error]`. Root cause analysis requires guessing.
- Fix approach: Log the full error message in development (check `process.env.NODE_ENV !== 'production'`) and/or route errors to a structured observability sink (e.g., Cloudflare Workers Tail) rather than stripping them entirely.

**`checkWriteRateLimit` Has a TOCTOU Race on D1:**
- Issue: `checkWriteRateLimit` in `packages/core/src/d1.ts` does a `SELECT` then an `INSERT OR REPLACE`. Between the read and write, another request can pass the limit check before the count is incremented.
- Files: `packages/core/src/d1.ts:400-424`
- Impact: Under concurrent requests from the same IP/address (e.g., during a burst), more than `maxPerMinute` writes can slip through before the D1 counter is updated. D1 does not support transactions across separate statements in the same way SQLite does locally.
- Fix approach: Use a single `INSERT OR REPLACE INTO _meta (key, value) VALUES (?, IIF((SELECT CAST(substr(value, ...) AS INT) WHERE ...) < maxPerMinute, ..., value))` or accept the slight race as an acceptable tradeoff given the in-memory limiter is the primary guard.

**Schema-Listings and Schema-Terms Not in CLAUDE.md Deployment Checklist:**
- Issue: `packages/core/src/schema-listings.sql` and `packages/core/src/schema-terms.sql` exist alongside `schema.sql` and `schema-orders.sql`, but only the latter two appear in the CLAUDE.md "Apply via" block.
- Files: `packages/core/src/schema-listings.sql`, `packages/core/src/schema-terms.sql`
- Impact: New deployments or database resets that follow CLAUDE.md will be missing the `share_listings` and terms acceptance tables, causing 500 errors on those API routes.
- Fix approach: Add `wrangler d1 execute stela-db --file=packages/core/src/schema-listings.sql` and `--file=packages/core/src/schema-terms.sql` to CLAUDE.md Step 4 and Step 5.

---

## Performance Bottlenecks

**Bot Settlement Nonce Pre-Fetch Races Against Concurrent Runs:**
- Problem: The bot pre-fetches nonces for all unique borrowers/lenders in parallel before building calldata (`workers/bot/src/index.ts:194-203`). If any RPC call fails, the entire matched pair is skipped rather than retried. Under RPC instability, matched orders can be stuck for multiple cron cycles.
- Files: `workers/bot/src/index.ts:190-246`
- Cause: No per-nonce retry or fallback; `Promise.allSettled` correctly handles failures but the retry is deferred until the next 2-minute cron window.
- Improvement path: Add a short retry (1-2 attempts with 500ms backoff) for individual nonce RPC calls before the settlement loop, similar to the retry pattern in `workers/indexer/src/poll.ts:148-185`.

**D1 Write Rate Limiter Adds 2 D1 Reads Per Write Request:**
- Problem: Every POST/DELETE request on a write API route calls `rateLimitWrite`, which performs a D1 `SELECT` for IP and optionally a second `SELECT` for the address (total 2-4 D1 operations per request before the actual operation).
- Files: `apps/web/src/lib/api.ts:152-190`, `packages/core/src/d1.ts:400-424`
- Cause: Defense-in-depth design. The in-memory limiter is the primary guard; D1 is a cold-start fallback.
- Improvement path: Consider using Cloudflare KV or Durable Objects for rate limiting state, which would eliminate the D1 round-trips and provide true cross-isolate consistency.

**`getAssetsForInscriptions` Unbounded IN Clause:**
- Problem: `packages/core/src/d1.ts` `getAssetsForInscriptions(ids)` builds `IN (?, ?, ...)` with all IDs from a page. If the page limit is 50 inscriptions, this generates `IN (50 params)`. D1/SQLite handles this fine, but the query is not batched or paginated.
- Files: `packages/core/src/d1.ts:162-172`
- Cause: Simple implementation optimized for a single page of results.
- Improvement path: Acceptable at current scale. If pages grow beyond 50, consider batching into groups of 25.

---

## Fragile Areas

**Bot Distributed Lock Has a 150-Second TTL with a 2-Minute Cron:**
- Files: `workers/bot/src/index.ts:442`
- Why fragile: The lock TTL is 150 seconds (2.5 minutes) but the cron fires every 2 minutes. If a bot run takes between 120 and 150 seconds, the next cron fires, fails to acquire the lock, and skips. If a run takes more than 150 seconds (e.g., many settlements with RPC delays), the lock expires and two instances run concurrently, risking nonce conflicts on StarkNet.
- Safe modification: Do not reduce `TX_TIMEOUT_MS` (120s) without also reducing `LOCK_TTL_SECONDS` proportionally. Monitor cron run durations in Cloudflare logs.
- Test coverage: No unit tests for the bot cron logic.

**Poll Fallback Fetches Transaction Calldata for Every `InscriptionCreated` Event:**
- Files: `workers/indexer/src/poll.ts:122-205`
- Why fragile: For each `InscriptionCreated` event, the poll path makes an additional `starknet_getTransactionByHash` RPC call to get calldata for asset parsing. If the RPC is throttled or the transaction is missing, assets are silently stored as empty arrays. The fallback uses Cartridge's public RPC with no API key and no retry for this call (only the `get_inscription` call retries).
- Safe modification: When modifying the poll path, always test with both RPC success and failure scenarios. Check that `inscription.debt_asset_count` remains consistent with actual `inscription_assets` rows.

**Webhook Idempotency Is Block-Level, Not Event-Level:**
- Files: `workers/indexer/src/index.ts:75-78`
- Why fragile: The indexer worker skips an entire webhook payload if `block_number <= last_block`. If a batch is partially processed (some events succeed, then one fails, returning a 500), the block cursor is NOT advanced. On retry, all events in that block are re-processed, relying on the `UNIQUE INDEX idx_events_dedup` to prevent duplicate `inscription_events` rows — but `upsertInscription` is not idempotent-safe if status transitions are applied twice with different data.
- Safe modification: Be cautious when adding new event handlers in `workers/indexer/src/handlers/index.ts` that update inscription state. Verify handlers are idempotent.

**`verifyStarknetSignature` Returns `false` on RPC Failure (Fails Closed) — But Has No Alerting:**
- Files: `apps/web/src/lib/verify-signature.ts:84-134`
- Why fragile: The function returns `false` (rejects the signature) when the RPC is down, which is the correct security posture. But there is no metric or alert when this happens — order creation silently fails with "Invalid signature" while the actual cause is RPC downtime. Users see an inscrutable error.
- Safe modification: Add a distinguishable error code or log tag for "RPC failure during sig verify" vs "signature actually invalid" so Cloudflare Tail Workers or log monitoring can alert on this.

---

## Missing Critical Features

**T1 Features Not Bot-Automated:**
- Problem: Collection offers, refinance offers, renegotiations, and collateral sales are stored in D1 but there is no bot cron logic to settle, expire, or clean up their stale records. Unlike core orders (`expireOrders`, `expireStaleNonceOrders`, `purgeStaleSignatures`), T1 records have no automated lifecycle management.
- Blocks: T1 features will accumulate stale `pending` records indefinitely. Lenders who walk away without cancelling leave their collection offers open forever.
- Files: `workers/bot/src/index.ts` (no T1 handling present), `apps/web/src/app/api/collection-offers/route.ts`, `apps/web/src/app/api/refinances/route.ts`, `apps/web/src/app/api/renegotiations/route.ts`

**No Bot-Side Settlement for T1 Flows:**
- Problem: Collection offer acceptances (`collection_offer_acceptances`), refinance approvals (`refinance_approvals`), and renegotiation commitments require on-chain settlement, but the bot only calls `settle()` for core `orders`. T1 settlements must be triggered by the frontend user.
- Blocks: If the user closes the browser after signing but before calling settle, the match is stuck. No automated recovery.

**Share Listing Fill Has No On-Chain Verification:**
- Problem: `POST /api/share-listings/:id` marks a share listing as filled based solely on a self-reported `tx_hash`. The route does not call `provider.getTransactionReceipt` or check for a `TransferSingle` event to confirm the transfer occurred.
- Blocks: Attackers can mark any listing as filled without paying. The seller loses the listing slot and must create a new one.
- Files: `apps/web/src/app/api/share-listings/[id]/route.ts:77-107`

---

## Test Coverage Gaps

**No Tests Exist Anywhere in the Repository:**
- What's not tested: All business logic — D1 queries, signature verification, nonce verification, rate limiting, bot cron logic, webhook event processing, settlement calldata construction, u256 serialization, event parsing.
- Files: Entire `packages/core/src/`, `workers/bot/src/`, `workers/indexer/src/`, `services/indexer/src/`, `apps/web/src/`
- Risk: Any refactor of `d1.ts`, `u256.ts`, or the bot settlement flow can silently break production settlement. The calldata serialization in `workers/bot/src/index.ts:254-296` is especially fragile — a wrong field order causes silent on-chain revert.
- Priority: **High** — particularly for `packages/core/src/u256.ts`, `packages/core/src/d1.ts` (query correctness), and `workers/bot/src/index.ts` (calldata construction).

**Bot Calldata Construction Is Untested and Failure-Silent:**
- What's not tested: The `settleOrders` function in `workers/bot/src/index.ts` constructs an 11-field order struct + asset arrays + two signatures. If field order, u256 encoding, or array length prefix is wrong, `account.execute` submits a transaction that reverts on-chain. The bot catches the error and leaves the order as `matched` for retry — but there is no alert and the order stays stuck indefinitely.
- Files: `workers/bot/src/index.ts:254-296`
- Risk: A single ABI change in the contract's `settle()` parameters silently breaks all settlement until manually diagnosed.
- Priority: **High**

---

## Scaling Limits

**D1 `_meta` Table Used for Rate Limiting, Locking, and Block Cursor — No Cleanup:**
- Current capacity: D1 SQLite; `_meta` accumulates one row per unique `rl:{ip}` key seen. With many unique IPs (e.g., scrapers, public access), this table grows unboundedly.
- Limit: D1 SQLite has no row limit per table, but large `_meta` scans degrade `checkWriteRateLimit` lookup performance over time.
- Scaling path: Add a periodic cleanup cron (e.g., `DELETE FROM _meta WHERE key LIKE 'rl:%' AND ...` based on stale bucket values), or migrate rate limiting state to Cloudflare KV with TTL.

**Bot Caps Liquidations at 10 and Settlements at 10 Per Run:**
- Current capacity: `MAX_LIQUIDATIONS_PER_RUN = 10`, `MAX_SETTLEMENTS_PER_RUN = 10` in `workers/bot/src/index.ts:21-22`.
- Limit: If more than 10 inscriptions become liquidatable simultaneously (e.g., a market event causes a wave of expirations), only 10 are processed per 2-minute window. Backlog drains at 10/run × 30 runs/hour = 300/hour.
- Scaling path: These caps are conservative. They can be raised once the bot's average run duration is measured. For large liquidation events, the cap should be dynamically adjustable via `_meta` config.

---

*Concerns audit: 2026-03-18*
