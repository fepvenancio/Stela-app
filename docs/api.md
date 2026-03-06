# API Reference

All API routes run as Next.js App Router route handlers on Cloudflare Workers. They query D1 directly via the Worker binding (`env.DB`) through `createD1Queries()` from `@stela/core`.

---

## Security

Every API route applies the following protections:

### Rate Limiting (`src/lib/rate-limit.ts`)

Sliding-window, in-memory rate limiter with separate stores for reads and writes:

| Scope | Limit | Applied to |
|---|---|---|
| IP-based reads | 60 req/min | All GET requests |
| IP-based writes | 10 req/min | All POST/DELETE requests |
| Address-based writes | 10 req/min | POST/DELETE with a StarkNet address |
| Body size | 50 KB max | POST/DELETE (returns 413 if exceeded) |

IP is resolved from `cf-connecting-ip` header, falling back to `x-forwarded-for`.

Expired entries are cleaned up every 60 seconds via `setInterval`.

### CORS (`src/lib/api.ts`)

Origin-reflected CORS for `stela-dapp.xyz` and `www.stela-dapp.xyz`. All routes expose an `OPTIONS` handler returning 204 with appropriate headers.

### Zod Validation (`src/lib/validation.ts`)

Write endpoints validate request bodies with Zod schemas:

- **`createOrderSchema`** -- Order creation: felt252 fields, asset arrays, addresses, signatures, nonce, deadline
- **`createOfferSchema`** -- Lender offers: BPS (1-10000), signature, nonce
- **`cancelOrderSchema`** -- Order cancellation: borrower address, signature

Read endpoints validate query/path params with schemas from `src/lib/schemas.ts`:

- **`inscriptionListSchema`** -- status, address, page (1-1000), limit (1-50)
- **`inscriptionIdSchema`** -- hex string ID
- **`addressSchema`** -- StarkNet address format
- **`syncRequestSchema`** -- tx_hash (hex), optional assets object

Signature inputs accept: `string[]` array, JSON string `"[r,s]"`, or `{r, s}` object. Normalized to `string[]`.

### Signature Verification (`src/lib/verify-signature.ts`)

Server-side SNIP-12 signature verification via raw JSON-RPC:

1. Reconstructs the SNIP-12 typed data server-side from submitted data
2. Computes the message hash using `starknetTypedData.getMessageHash()`
3. Calls `is_valid_signature(hash, signature)` on the signer's account contract via `starknet_call`
4. Checks for `'VALID'` shortstring (`0x56414c4944`) in the response

Uses only `fetch()` -- no starknet.js Account instance needed. Works in Cloudflare Workers.

### Nonce Verification (`src/lib/verify-nonce.ts`)

On-chain nonce validation for order creation:

1. Reads `nonces(address)` from the Stela contract via `starknet_call`
2. Compares against the submitted nonce (equality check -- OZ `use_checked_nonce` semantics)
3. Rejects orders with consumed nonces
4. Also checks for duplicate pending orders with the same borrower + nonce

Fails open on RPC errors (returns `{ valid: true }`) to avoid blocking valid requests.

### Error Handling (`src/lib/errors.ts`)

Structured error class hierarchy:

| Class | Status | Code |
|---|---|---|
| `AppError` | configurable | configurable |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `RateLimitError` | 429 | `RATE_LIMITED` |

Error responses are JSON: `{ error: string, code?: string }`.

---

## Inscription Routes

### `GET /api/inscriptions`

List inscriptions with filtering and pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | -- | Filter by status: `open`, `partial`, `filled`, `repaid`, `liquidated`, `expired`, `cancelled` |
| `address` | string | -- | Filter by creator, borrower, or lender address (case-insensitive, handles address padding) |
| `page` | number | 1 | Page number (1-1000) |
| `limit` | number | 20 | Results per page (1-50) |

**Response:**

```json
{
  "data": [
    {
      "id": "0x...",
      "creator": "0x...",
      "borrower": "0x...",
      "status": "open",
      "duration": 86400,
      "deadline": 1740000000,
      "assets": [
        { "inscription_id": "...", "asset_role": "debt", "asset_address": "0x...", "asset_type": "ERC20", "value": "1000000", "token_id": "0" }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5 }
}
```

Assets are batch-fetched for all returned inscriptions and grouped by inscription ID.

### `GET /api/inscriptions/[id]`

Single inscription detail with assets.

**Response:**

```json
{
  "data": {
    "id": "0x...",
    "creator": "0x...",
    "status": "filled",
    "assets": [ ... ]
  }
}
```

### `GET /api/inscriptions/[id]/events`

Event history for an inscription, ordered by block number ascending.

**Response:**

```json
{
  "data": {
    "events": [
      { "event_type": "created", "tx_hash": "0x...", "block_number": 100000, "timestamp": 1740000000, "data": null },
      { "event_type": "signed", "tx_hash": "0x...", "block_number": 100010, "timestamp": 1740001000, "data": "{\"borrower\":\"0x...\",\"lender\":\"0x...\"}" }
    ]
  }
}
```

### `GET /api/inscriptions/[id]/locker`

Locker TBA (Token Bound Account) address for an inscription.

**Response:**

```json
{ "data": { "locker_address": "0x..." } }
```

Returns 404 if no locker exists.

---

## Address Routes

### `GET /api/shares/[address]`

ERC1155 share balances for an address across all inscriptions (non-zero only).

**Response:**

```json
{
  "data": {
    "address": "0x...",
    "balances": [
      { "inscription_id": "0x...", "balance": "10000" }
    ]
  }
}
```

### `GET /api/treasury/[address]`

Aggregated locked collateral assets for an address. Groups collateral by token address across all `filled`/`partial` inscriptions where the address is the creator.

**Response:**

```json
{
  "data": {
    "address": "0x...",
    "locked_assets": [
      {
        "token_address": "0x...",
        "token_symbol": "mUSDC",
        "total_locked": "5000000",
        "inscriptions": [
          { "inscription_id": "0x...", "value": "3000000", "status": "filled" },
          { "inscription_id": "0x...", "value": "2000000", "status": "partial" }
        ]
      }
    ]
  }
}
```

### `GET /api/lockers/[address]`

All locker TBA addresses for inscriptions created by a given address.

**Response:**

```json
{
  "data": [
    { "inscription_id": "0x...", "locker_address": "0x..." }
  ]
}
```

---

## Order Routes

### `GET /api/orders`

List off-chain orders.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | `pending` | Filter: `pending`, `matched`, `settled`, `expired`, `cancelled`, `all` |
| `address` | string | -- | Filter by borrower or lender (searches both `orders.borrower` and `order_offers.lender`) |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page (max 50) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "borrower": "0x...",
      "status": "pending",
      "deadline": 1740000000,
      "order_data": {
        "borrower": "0x...",
        "debtAssets": [...],
        "interestAssets": [...],
        "collateralAssets": [...],
        "duration": "86400",
        "deadline": "1740000000",
        "multiLender": false,
        "nonce": "0"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

The `order_data` TEXT column is parsed from JSON and normalized (camelCase/snake_case variants handled by `parseOrderRow()`).

### `POST /api/orders`

Create a new off-chain order.

**Request Body (validated by `createOrderSchema`):**

```json
{
  "id": "uuid",
  "borrower": "0x...",
  "order_data": {
    "borrower": "0x...",
    "debtAssets": [{ "asset_address": "0x...", "asset_type": "ERC20", "value": "1000000", "token_id": "0" }],
    "interestAssets": [...],
    "collateralAssets": [...],
    "duration": "86400",
    "deadline": "1740100000",
    "multiLender": false,
    "nonce": "0"
  },
  "borrower_signature": ["0x...", "0x..."],
  "nonce": "0",
  "deadline": 1740100000
}
```

**Server-side validation steps:**

1. Zod schema validation
2. Rate limit (IP + borrower address)
3. Deadline must be in the future
4. Reconstruct SNIP-12 `InscriptionOrder` typed data server-side
5. Compute message hash via `starknetTypedData.getMessageHash()`
6. Verify borrower signature on-chain (`is_valid_signature`)
7. Verify on-chain nonce matches submitted nonce
8. Check no duplicate pending order with same borrower + nonce
9. Verify asset hashes if provided (defense in depth)
10. Store order with computed `orderHash` in D1

**Response:** `{ "ok": true, "id": "uuid" }`

**Error responses:** 400 (validation), 401 (invalid signature), 409 (duplicate nonce)

### `GET /api/orders/[id]`

Single order detail with attached offers.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "borrower": "0x...",
    "status": "pending",
    "order_data": { ... },
    "offers": [
      {
        "id": "uuid",
        "lender": "0x...",
        "bps": 10000,
        "status": "pending",
        "created_at": 1740000000
      }
    ]
  }
}
```

### `DELETE /api/orders/[id]`

Cancel a pending order. Requires the borrower to sign a `CancelOrder` SNIP-12 typed data message.

**Request Body (validated by `cancelOrderSchema`):**

```json
{
  "borrower": "0x...",
  "signature": ["0x...", "0x..."]
}
```

**Validation steps:**

1. Zod schema validation
2. Rate limit (IP + borrower address)
3. Order must exist and be `pending`
4. Caller address must match order borrower (normalized comparison)
5. Reconstruct `CancelOrder` typed data, compute hash
6. Verify signature on-chain

**Response:** `{ "ok": true }`

**Error responses:** 400 (not pending), 403 (not authorized), 404 (not found), 401 (invalid signature)

### `POST /api/orders/[id]/offer`

Submit a lender offer against an order.

**Request Body (validated by `createOfferSchema`):**

```json
{
  "id": "uuid",
  "lender": "0x...",
  "bps": 10000,
  "lender_signature": ["0x...", "0x..."],
  "nonce": "0",
  "tx_hash": "0x..."
}
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique offer ID |
| `lender` | yes | Lender address |
| `bps` | yes | Basis points to lend (1-10000) |
| `lender_signature` | yes | SNIP-12 LendOffer signature |
| `nonce` | yes | Lender's on-chain nonce |
| `tx_hash` | no | If present, settlement already happened on-chain |

**Status transition logic:**

- If `tx_hash` is provided: order -> `settled`, offer -> `settled` (user already settled on-chain, skip sig verification)
- If no `tx_hash`: order -> `matched`, offer -> `pending` (bot will settle later)

**Response:** `{ "ok": true, "id": "uuid", "status": "matched" | "settled" }`

---

## Sync Route

### `POST /api/sync`

Immediate sync bridge: waits for a transaction receipt, parses Stela events, and writes to D1.

**Request Body:**

```json
{
  "tx_hash": "0x...",
  "assets": {
    "debt": [{ "asset_address": "0x...", "asset_type": "ERC20", "value": "1000000", "token_id": "0" }],
    "interest": [...],
    "collateral": [...]
  }
}
```

The optional `assets` field provides asset details for `InscriptionCreated` events (since assets are in calldata, not in the event).

**Processing steps:**

1. Wait for transaction receipt via `provider.waitForTransaction(tx_hash)`
2. Check `execution_status === 'SUCCEEDED'` (returns 422 if reverted)
3. Filter receipt events to those from the Stela contract address
4. Parse events using `parseEvents()` from SDK
5. For each event, mirror the indexer handler logic: upsert inscription, insert assets, insert events, update share balances
6. Return count of processed events

**Response:** `{ "ok": true, "events": 3 }`

**Handled event types:** InscriptionCreated, InscriptionSigned, InscriptionCancelled, InscriptionRepaid, InscriptionLiquidated, SharesRedeemed, TransferSingle

---

## Health Route

### `GET /api/health`

D1 connectivity check.

**Response:** `{ "data": { "status": "ok", "d1": true } }`

Returns 503 if D1 is unreachable.
