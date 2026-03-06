# D1 Schema Reference

**Database:** Cloudflare D1 (SQLite)
**Database name:** `stela-db`
**Database ID:** `e8633170-f033-4e41-8c45-ab59f07d4006`

All Workers and Next.js API routes share this database via Wrangler D1 bindings. Access is through `createD1Queries(env.DB)` from `@stela/core`.

Schema files:
- `packages/core/src/schema.sql` -- main tables
- `packages/core/src/schema-orders.sql` -- order/offer tables

All DDL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` -- safe to re-run.

---

## Tables

### `inscriptions`

Main inscription state. Source of truth for indexer-computed status.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | u256 as 0x-prefixed 64-char hex string |
| `creator` | TEXT | NOT NULL | Borrower who created the inscription |
| `borrower` | TEXT | | Borrower address (set on signing) |
| `lender` | TEXT | | Last lender address (set on signing) |
| `status` | TEXT | NOT NULL DEFAULT 'open' | `open`, `partial`, `filled`, `repaid`, `liquidated`, `expired`, `cancelled` |
| `issued_debt_percentage` | INTEGER | NOT NULL DEFAULT 0 | BPS (0-10000) of debt that has been lent |
| `multi_lender` | INTEGER | NOT NULL DEFAULT 0 | Boolean: allows multiple lenders |
| `duration` | INTEGER | | Loan duration in seconds |
| `deadline` | INTEGER | | Unix timestamp: order expiry |
| `signed_at` | INTEGER | | Unix timestamp: when first lender signed |
| `debt_asset_count` | INTEGER | | Number of debt asset entries |
| `interest_asset_count` | INTEGER | | Number of interest asset entries |
| `collateral_asset_count` | INTEGER | | Number of collateral asset entries |
| `created_at_block` | INTEGER | | Block number when created |
| `created_at_ts` | INTEGER | | Unix timestamp when created |
| `updated_at_ts` | INTEGER | | Unix timestamp of last update |

**Indexes:**
- `idx_inscriptions_status` on `status`
- `idx_inscriptions_creator` on `creator`
- `idx_inscriptions_borrower` on `borrower`
- `idx_inscriptions_lender` on `lender`
- `idx_inscriptions_deadline` on `deadline`

### `inscription_assets`

Per-inscription asset details by role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `inscription_id` | TEXT | NOT NULL, FK -> inscriptions(id) | Parent inscription |
| `asset_role` | TEXT | NOT NULL | `debt`, `interest`, or `collateral` |
| `asset_index` | INTEGER | NOT NULL | Ordinal within role |
| `asset_address` | TEXT | NOT NULL | Token contract address |
| `asset_type` | TEXT | NOT NULL | `ERC20`, `ERC721`, `ERC1155`, `ERC4626` |
| `value` | TEXT | | Token amount as string (u256 scale) |
| `token_id` | TEXT | | NFT token ID (for ERC721/ERC1155) |

**Primary key:** `(inscription_id, asset_role, asset_index)`

Uses `INSERT OR IGNORE` for idempotent writes.

### `inscription_events`

Event history log for auditing and timeline display.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-incrementing ID |
| `inscription_id` | TEXT | NOT NULL | Related inscription |
| `event_type` | TEXT | NOT NULL | `created`, `signed`, `cancelled`, `repaid`, `liquidated`, `redeemed`, `transfer_single` |
| `tx_hash` | TEXT | NOT NULL | Transaction hash |
| `block_number` | INTEGER | NOT NULL | Block number |
| `timestamp` | INTEGER | | Unix timestamp |
| `data` | TEXT | | JSON payload (event-specific details) |

**Dedup index:** `idx_events_dedup` UNIQUE on `(inscription_id, event_type, tx_hash)` -- prevents duplicate event processing.

Uses `INSERT OR IGNORE` for idempotent writes.

### `lockers`

Mapping of inscriptions to their locker TBA (Token Bound Account) contracts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `inscription_id` | TEXT | PRIMARY KEY | Parent inscription |
| `locker_address` | TEXT | NOT NULL | Locker contract address |
| `created_at_ts` | INTEGER | | Unix timestamp |

**Index:** `idx_lockers_address` on `locker_address`

### `share_balances`

ERC1155 share balances per account per inscription. Updated on `TransferSingle` events.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `account` | TEXT | NOT NULL | Holder address |
| `inscription_id` | TEXT | NOT NULL | Inscription ID |
| `balance` | TEXT | NOT NULL DEFAULT '0' | Balance as string (BigInt-safe for u256 values) |

**Primary key:** `(account, inscription_id)`
**Index:** `idx_shares_account` on `account`

Balance arithmetic uses BigInt in JavaScript (not SQLite CAST, which overflows for u256 values). `INSERT OR REPLACE` for atomic update.

### `orders`

Off-chain SNIP-12 signed orders created by borrowers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `borrower` | TEXT | NOT NULL | Normalized (0x-padded, lowercase) borrower address |
| `order_data` | TEXT | NOT NULL | JSON: full loan terms (assets, duration, deadline, nonce, hashes) |
| `borrower_signature` | TEXT | NOT NULL | JSON: signature array |
| `nonce` | TEXT | NOT NULL | On-chain nonce at time of signing |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | `pending`, `matched`, `settled`, `expired`, `cancelled` |
| `deadline` | INTEGER | NOT NULL | Unix timestamp: order expiry |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:**
- `idx_orders_status` on `status`
- `idx_orders_borrower` on `borrower`
- `idx_orders_deadline` on `deadline`

### `order_offers`

Lender offers against off-chain orders.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `order_id` | TEXT | NOT NULL, FK -> orders(id) | Parent order |
| `lender` | TEXT | NOT NULL | Lender address |
| `bps` | INTEGER | NOT NULL | Basis points to lend (1-10000) |
| `lender_signature` | TEXT | NOT NULL | JSON: signature array |
| `nonce` | TEXT | NOT NULL | Lender's on-chain nonce at time of signing |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | `pending`, `settled`, `expired` |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:**
- `idx_order_offers_order_id` on `order_id`
- `idx_order_offers_lender` on `lender`
- `idx_order_offers_status` on `status`

### `_meta`

Key-value store for operational state.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | Meta key name |
| `value` | TEXT | NOT NULL | Meta value |

**Known keys:**
- `last_block` -- Last indexed block number (initialized to `'0'`)
- `bot_lock` -- Bot distributed lock timestamp (set to epoch seconds, `'0'` when released)

---

## Key Queries (`createD1Queries`)

All database access goes through the `createD1Queries(db)` factory from `@stela/core`. This returns an object with the following methods:

### Read Methods

| Method | Description | SQL |
|---|---|---|
| `getInscriptions({ status, address, page, limit })` | Paginated inscription list with filtering. Expired status uses compound condition (open+past-deadline OR filled+past-duration). Address search checks creator/borrower/lender with padded/stripped variants. | `SELECT * FROM inscriptions WHERE ... ORDER BY created_at_ts DESC LIMIT ? OFFSET ?` |
| `getInscription(id)` | Single inscription by ID | `SELECT * FROM inscriptions WHERE id = ?` |
| `getInscriptionAssets(id)` | Assets for one inscription | `SELECT * FROM inscription_assets WHERE inscription_id = ? ORDER BY asset_role, asset_index` |
| `getAssetsForInscriptions(ids)` | Batch asset fetch for multiple inscriptions | `SELECT * FROM inscription_assets WHERE inscription_id IN (...)` |
| `getInscriptionEvents(id)` | Event history for one inscription | `SELECT * FROM inscription_events WHERE inscription_id = ? ORDER BY block_number ASC, id ASC` |
| `getLockerAddress(id)` | Locker TBA address | `SELECT locker_address FROM lockers WHERE inscription_id = ?` |
| `getLockersByCreator(address)` | All lockers for a creator | `SELECT l.* FROM lockers l JOIN inscriptions i ON ... WHERE LOWER(i.creator) = LOWER(?)` |
| `getShareBalances(account)` | Non-zero share balances | `SELECT inscription_id, balance FROM share_balances WHERE account = ? AND balance != '0'` |
| `getShareBalance(account, id)` | Single balance | `SELECT balance FROM share_balances WHERE account = ? AND inscription_id = ?` |
| `getLockedAssetsByAddress(address)` | Collateral assets for filled/partial inscriptions | Joins `inscription_assets` + `inscriptions` where creator = address and role = 'collateral' |
| `getLastBlock()` | Last indexed block number | `SELECT value FROM _meta WHERE key = 'last_block'` |
| `getMeta(key)` | Read _meta value | `SELECT value FROM _meta WHERE key = ?` |
| `getOrder(id)` | Single order | `SELECT * FROM orders WHERE id = ?` |
| `getOrders({ status, address, page, limit })` | Paginated order list. Address search checks both `orders.borrower` and `order_offers.lender` (subquery). | `SELECT * FROM orders WHERE ... ORDER BY created_at DESC` |
| `getOrderOffers(orderId)` | All offers for an order | `SELECT * FROM order_offers WHERE order_id = ? ORDER BY created_at DESC` |
| `getMatchedOrders()` | Orders ready for bot settlement (matched + pending offer + not expired). Limited to 20. | `SELECT o.id, oo.id FROM orders o JOIN order_offers oo ON ... WHERE o.status = 'matched' AND oo.status = 'pending' AND o.deadline > ?` |
| `findLiquidatable(nowSeconds)` | Filled inscriptions past their duration. Limited to 50. | `SELECT id FROM inscriptions WHERE status = 'filled' AND signed_at IS NOT NULL AND (signed_at + duration) < ?` |

### Write Methods

| Method | Description |
|---|---|
| `upsertInscription(data)` | Insert or update inscription. Column-allowlisted to prevent SQL injection. If `creator` is missing (update-only), falls back to plain UPDATE. |
| `insertAsset(data)` | `INSERT OR IGNORE` into inscription_assets |
| `insertEvent(data)` | `INSERT OR IGNORE` into inscription_events (JSON-serializes `data` field) |
| `insertEventReturning(data)` | Same as insertEvent but returns boolean: true if actually inserted, false if dedup'd |
| `updateInscriptionStatus(id, status, updatedAt)` | Validates status against `VALID_STATUSES` |
| `incrementShareBalance(account, id, amount)` | BigInt-safe: read current, add, write back via `INSERT OR REPLACE` |
| `decrementShareBalance(account, id, amount)` | BigInt-safe: read current, subtract (floor at 0n), write back |
| `upsertLocker(inscriptionId, lockerAddress, timestamp)` | `INSERT OR REPLACE` into lockers |
| `setLastBlock(block)` | Update indexer cursor in _meta |
| `setMeta(key, value)` | `INSERT OR REPLACE` into _meta |
| `expireOpenInscriptions(nowSeconds)` | Bulk update open inscriptions past deadline to expired |
| `createOrder(data)` | Insert new order with normalized borrower address |
| `updateOrderStatus(id, status)` | Update order status |
| `createOrderOffer(data)` | Insert new offer |
| `updateOfferStatus(id, status)` | Update offer status |
| `expireOrders(nowSeconds)` | Bulk update pending orders past deadline to expired |

### Important Implementation Details

- **Address normalization:** Borrower addresses are normalized on write (`0x` + lowercase + padStart 64). Reads compare multiple address variants (padded, lowercase, stripped).
- **BigInt safety:** Share balances stored as TEXT, arithmetic done in JavaScript BigInt (SQLite CAST(AS INTEGER) overflows for u256 values).
- **Idempotency:** All insert operations use `INSERT OR IGNORE` to safely handle re-processing of events.
- **Column allowlist:** `upsertInscription` only accepts columns in the `INSCRIPTION_COLUMNS` set, preventing SQL injection via dynamic keys.
