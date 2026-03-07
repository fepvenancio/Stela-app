# Match Detection System

How Stela detects and surfaces compatible counterparties when a user creates an inscription or order.

---

## Overview

When a user fills out the "Inscribe" form on `/create`, the frontend checks in real-time whether any existing orders or inscriptions could be settled against theirs. This enables **instant settlement** — instead of waiting for a counterparty, the user can settle immediately.

There are two independent match pipelines that run in parallel:

1. **Off-chain match** — finds pending off-chain orders (SNIP-12 signed, stored in D1) whose assets mirror the user's
2. **On-chain match** — finds open on-chain inscriptions (indexed from StarkNet events into D1) whose assets mirror the user's

---

## Trigger Conditions

Match detection is triggered by a `useEffect` in `apps/web/src/app/create/page.tsx` (line ~256) with a 500ms debounce. It fires when ALL of these conditions are true:

- User wallet is connected (`address` is set)
- Exactly **1 debt asset** is selected (with a token address)
- Exactly **1 collateral asset** is selected (with a token address)
- `multiLender` mode is **off**

If any condition fails, match detection is skipped entirely (multi-asset or multi-lender inscriptions cannot be swap-matched).

```
User fills form → useEffect fires → 500ms debounce → checkForMatches()
```

---

## Frontend Flow

### 1. `useMatchDetection` hook (`apps/web/src/hooks/useMatchDetection.ts`)

The `checkForMatches` function receives:

```typescript
{
  debtToken: string        // token address the user wants to borrow
  collateralToken: string  // token address the user offers as collateral
  duration: string         // loan duration in seconds (or "0" for swaps)
  borrowerAddress: string  // the connected user's wallet address
}
```

It fires two `fetch` calls in parallel via `Promise.allSettled`:

#### Request 1: Off-chain orders
```
GET /api/orders/match?debtToken=X&collateralToken=Y&duration=Z&borrower=ADDRESS
```

#### Request 2: On-chain inscriptions
```
GET /api/inscriptions/match?debtToken=X&collateralToken=Y&duration=Z&lender=ADDRESS
```

Either endpoint failing does NOT block the other — `Promise.allSettled` ensures partial results are still shown.

### 2. Results displayed

If any matches are found, the `InlineMatchList` component renders below the form with options to:
- **Instant settle** a single off-chain order (sign + settle in one flow)
- **Settle on-chain** against an existing inscription
- **Multi-settle** multiple off-chain orders in a single batch transaction
- **Skip** — dismiss matches and proceed with normal inscription creation

---

## API Routes

### `GET /api/orders/match` (`apps/web/src/app/api/orders/match/route.ts`)

Finds off-chain orders where the counterparty wants the opposite of what the user wants.

**Query params:** `debtToken`, `collateralToken`, `duration`, `borrower`

**Calls:** `db.findCompatibleOrders()`

**Logic (mirror matching):**
- The user's `debtToken` (what they want to borrow) = the counterparty's `collateral_token` (what the counterparty offered)
- The user's `collateralToken` (what they offer) = the counterparty's `debt_token` (what the counterparty wants to borrow)

So the query swaps the tokens:
```sql
WHERE debt_token = ? AND collateral_token = ?
-- bound as: (normalizedCollateral, normalizedDebt)
-- i.e., their debt = my collateral, their collateral = my debt
```

**Additional filters:**
- `status = 'pending'` (not matched, settled, expired, or cancelled)
- `deadline > NOW` (not expired)
- `duration_seconds = ?` (must match exactly)
- `borrower != ?` (exclude the user's own orders)
- `borrower_signature IS NOT NULL` (must have a valid signature)

**Returns:** Up to 20 orders with `id`, `borrower`, `borrower_signature`, `nonce`, `deadline`, `created_at`, and parsed `order_data` JSON.

### `GET /api/inscriptions/match` (`apps/web/src/app/api/inscriptions/match/route.ts`)

Finds on-chain inscriptions where the creator wants the opposite assets.

**Query params:** `debtToken`, `collateralToken`, `duration`, `lender`

**Calls:** `db.findCompatibleInscriptions()`

**SQL query:**
```sql
SELECT DISTINCT i.id, i.creator, i.borrower, i.duration, i.deadline, i.status
FROM inscriptions i
JOIN inscription_assets ia_debt
  ON ia_debt.inscription_id = i.id
  AND ia_debt.asset_role = 'debt'
  AND LOWER(ia_debt.asset_address) = LOWER(?)     -- matches user's debtToken
JOIN inscription_assets ia_coll
  ON ia_coll.inscription_id = i.id
  AND ia_coll.asset_role = 'collateral'
  AND LOWER(ia_coll.asset_address) = LOWER(?)     -- matches user's collateralToken
WHERE i.status = 'open'
  AND i.multi_lender = 0
  AND LOWER(i.creator) != LOWER(?)                -- exclude user's own inscriptions
  AND CAST(i.duration AS INTEGER) = ?             -- optional: exact duration match
ORDER BY i.created_at_ts DESC
LIMIT ?
```

**Key detail:** This query matches on the SAME tokens (not mirrored). An on-chain inscription's `debt` is what the creator wants to borrow and `collateral` is what they locked. The frontend passes the user's desired tokens directly — if both inscriptions want the same debt/collateral pair, they're compatible for a swap where one becomes the lender for the other.

**Returns:** Up to 10 inscriptions with `id`, `creator`, `borrower`, `duration`, `deadline`, `status`.

---

## D1 Query Layer (`packages/core/src/d1.ts`)

### `findCompatibleOrders` (line ~649)

```typescript
async findCompatibleOrders(params: {
  myDebtToken: string       // what I want to borrow
  myCollateralToken: string // what I offer as collateral
  duration: number          // exact duration match
  borrower: string          // exclude my own orders
  nowSeconds: number        // filter expired orders
})
```

The token swap happens at bind time:
```typescript
.bind(
  params.nowSeconds,
  normalizedCollateral,  // their debt_token = my collateral (they want what I offer)
  normalizedDebt,        // their collateral_token = my debt (they offer what I want)
  params.duration,
  normalizedBorrower,
)
```

### `findCompatibleInscriptions` (line ~555)

```typescript
async findCompatibleInscriptions(params: {
  debtToken: string         // token address
  collateralToken: string   // token address
  duration?: number         // optional exact match
  excludeBorrower: string   // exclude this creator
  limit?: number            // max results (default 10, cap 50)
})
```

Uses `i.creator` (not `i.borrower`) for exclusion because open inscriptions have `borrower = NULL` — the borrower is only set when an inscription is signed/filled.

---

## Settlement Paths

Once matches are detected, the user can settle through three paths:

### Path A: Instant Settle (off-chain order)

1. User signs a `LendOffer` SNIP-12 typed data (lender signature)
2. Frontend POSTs the offer to `/api/orders/:id/offer`
3. Order status changes from `pending` → `matched`
4. Bot picks it up on next cron (every 2 min) and calls `settle()` on-chain

### Path B: On-chain Settle

1. User calls `sign_inscription()` directly on the Stela contract via their wallet
2. This signs the existing on-chain inscription as the lender
3. No bot involvement — settlement happens in the same transaction

### Path C: Multi-Settle (batch off-chain)

1. User selects multiple off-chain orders
2. Signs a single `BatchLendOffer` SNIP-12 typed data
3. Frontend builds a multicall with `batch_settle()` and executes it directly
4. All orders settled atomically in one transaction

---

## Bot Settlement Workflow (`workers/bot/src/index.ts`)

The bot runs every 2 minutes via Cloudflare Cron Trigger:

```
1. Acquire D1 lock (prevent overlapping runs)
2. Expire orders past deadline → status = 'expired'
3. Expire orders with stale nonces (on-chain nonce != order nonce) → status = 'expired'
4. Purge signatures from expired/cancelled orders
5. Settle matched orders:
   a. Load all orders with status = 'matched' from D1
   b. For each: verify both borrower and lender nonces still match on-chain
   c. Build settle() calldata (order struct + assets + signatures)
   d. Execute via Account.execute() (single or batch)
   e. On success: mark order + offer as 'settled', expire sibling orders, purge signatures
   f. On failure: leave as 'matched' for retry next cron
6. Liquidate expired inscriptions (filled inscriptions past duration)
7. Release D1 lock
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User on /create                       │
│                                                         │
│  Selects: 1 debt token + 1 collateral token + duration  │
│  multiLender = false, wallet connected                  │
└────────────────────┬────────────────────────────────────┘
                     │ useEffect (500ms debounce)
                     ▼
         ┌───────────────────────┐
         │   checkForMatches()   │
         └───────┬───────┬───────┘
                 │       │
    ┌────────────┘       └────────────┐
    ▼                                 ▼
┌──────────────────┐      ┌──────────────────────┐
│ GET /api/orders  │      │ GET /api/inscriptions │
│    /match        │      │       /match          │
└────────┬─────────┘      └──────────┬────────────┘
         │                           │
         ▼                           ▼
┌──────────────────┐      ┌──────────────────────┐
│ findCompatible   │      │ findCompatible       │
│ Orders()         │      │ Inscriptions()       │
│                  │      │                      │
│ D1: orders table │      │ D1: inscriptions +   │
│ Token swap logic │      │ inscription_assets   │
│ (my debt=their   │      │ Direct token match   │
│  collateral)     │      │ Exclude by creator   │
└────────┬─────────┘      └──────────┬────────────┘
         │                           │
         └────────────┬──────────────┘
                      ▼
              ┌───────────────┐
              │ Results shown │
              │ in UI as      │
              │ InlineMatch   │
              │ List          │
              └───────┬───────┘
                      │ User chooses action
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ Instant  │ │ On-chain │ │ Multi-settle │
    │ Settle   │ │ Settle   │ │ (batch)      │
    │          │ │          │ │              │
    │ POST     │ │ sign_    │ │ batch_       │
    │ offer →  │ │ inscrip- │ │ settle()     │
    │ bot      │ │ tion()   │ │ multicall    │
    │ settles  │ │ direct   │ │ direct       │
    └──────────┘ └──────────┘ └──────────────┘
```

---

## Order Status Lifecycle

```
                    POST /api/orders
                         │
                         ▼
                    ┌──────────┐
                    │ pending  │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ matched  │   │ expired  │   │cancelled │
    │ (offer   │   │ (deadline│   │ (borrower│
    │  accepted│   │  or stale│   │  signs   │
    │  via API)│   │  nonce)  │   │  cancel) │
    └────┬─────┘   └──────────┘   └──────────┘
         │
         ▼
    ┌──────────┐
    │ settled  │
    │ (bot or  │
    │  user    │
    │  settles │
    │  on-chain│
    └──────────┘
```

---

## Inscription Status Lifecycle

```
              create_inscription() on-chain
                         │
                         ▼
                    ┌──────────┐
                    │   open   │ ← match detection queries this
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ partial  │   │ expired  │   │cancelled │
    │ (lender  │   │ (deadline│   │ (creator │
    │  signed, │   │  passed) │   │  cancels)│
    │  < 100%) │   └──────────┘   └──────────┘
    └────┬─────┘
         │ issued_debt_percentage >= 10000 BPS
         ▼
    ┌──────────┐
    │  filled  │
    └────┬─────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌───────────┐
│ repaid │ │liquidated │
└────────┘ └───────────┘
```
