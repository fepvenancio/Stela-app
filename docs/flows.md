# User Flows

Step-by-step flows for all user-facing operations in the Stela protocol.

---

## Create Inscription (Off-Chain Order)

**Page:** `/create`
**Actor:** Borrower
**Gas cost:** None (off-chain signing only)

```
1. Borrower fills form:
   - Debt assets (what they want to borrow)
   - Interest assets (reward for lender)
   - Collateral assets (locked guarantee)
   - Duration (loan term in seconds)
   - Deadline (order expiry timestamp)
   - Multi-lender toggle

2. Borrower clicks "Create Order"
   --> TransactionProgressModal opens (3 steps)

3. Step 1 — "Sign Order"
   a. Read on-chain nonce via getNonce(provider, CONTRACT_ADDRESS, address)
   b. Build InscriptionOrder SNIP-12 typed data (SDK: getInscriptionOrderTypedData)
   c. Wallet prompts for signature (account.signMessage)

4. Step 2 — "Submit to API"
   a. POST /api/orders with:
      - id (UUID)
      - borrower address
      - order_data (all terms + nonce + computed orderHash)
      - borrower_signature
      - nonce, deadline
   b. Server verifies: Zod schema, SNIP-12 signature, on-chain nonce, no duplicate nonce

5. Step 3 — "Confirmation"
   a. API returns { ok: true, id }
   b. Modal shows success

Order status: pending
```

---

## Browse & Lend — Public Settlement (Off-Chain Order)

**Page:** `/order/[id]`
**Actor:** Lender
**Gas cost:** approve + settle transaction

```
1. Lender navigates to /order/[id] page
   - Sees order details: debt/interest/collateral assets, duration, ROI, borrower
   - Privacy toggle defaults to OFF for this flow

2. For single-lender orders:
   --> "Sign & Settle 100%" button (bps = 10000)
   For multi-lender orders:
   --> Amount input, auto-calculates BPS from debt total

3. Lender clicks settle button
   --> TransactionProgressModal opens (3 steps)

4. Step 1 — "Approve & Settle"
   a. Fetch order data from GET /api/orders/:id
   b. Self-lending check (borrower != lender)
   c. Read on-chain nonces for lender + verify borrower nonce still valid
   d. Parse assets, compute orderHash (if not cached)
   e. Build LendOffer SNIP-12 typed data (SDK: getLendOfferTypedData)
   f. Wallet signs the offer (account.signMessage)
   g. Parse borrower signature from stored order
   h. Compute asset hashes
   i. Build ERC20 approve calls for debt tokens (amount = debt * bps / 10000)
   j. Build settle() call using InscriptionClient.buildSettle()
   k. Execute multicall: [...approveCalls, settleCall]

5. Step 2 — "Confirming on-chain"
   a. Wait for transaction receipt (provider.waitForTransaction)
   b. Transaction hash shown with Voyager link

6. Step 3 — "Saving offer"
   a. POST /api/orders/:id/offer with tx_hash
   b. Server marks order as "settled" (skips sig verification since tx already on-chain)

Order status: settled
On-chain: inscription created + funded in one tx
```

---

## Browse & Lend — Private Settlement

**Page:** `/order/[id]`
**Actor:** Lender (identity hidden)
**Gas cost:** approve + shield deposit transaction
**Prerequisite:** `PRIVACY_POOL_ADDRESS` configured

```
1. Lender navigates to /order/[id] page
   - Privacy toggle defaults to ON when pool is deployed

2. Lender clicks "Shield & Lend" button
   --> TransactionProgressModal opens (4 steps)

3. Step 1 — "Shield deposit"
   a. Fetch order data
   b. Self-lending check, nonce verification (same as public)
   c. Generate random salt via generateSalt()
   d. Compute deposit commitment via computeDepositCommitment(address, token, amount, salt)
   e. Build multicall:
      - Approve primary debt token to PRIVACY_POOL_ADDRESS
      - Shield deposit via InscriptionClient.buildShieldDeposit()
      - (Additional tokens: approve + transfer to pool)
   f. Wallet prompts for approval

4. Step 2 — "Confirming shield"
   a. Wait for shield tx confirmation on-chain

5. Step 3 — "Signing offer"
   a. Build anonymous LendOffer typed data with lender='0x0' and lenderCommitment=commitment
   b. Wallet signs the offer

6. Step 4 — "Submitting offer"
   a. POST /api/orders/:id/offer with:
      - lender: '0x0'
      - depositor: actual address (for sig verification)
      - lender_commitment: commitment hash
      - No tx_hash (bot will settle)
   b. Save private note to localStorage:
      - owner, inscriptionId (0n — not yet known), shares (bps), salt, commitment
   c. Order status: matched

7. Bot settlement (async, workers/bot cron):
   a. Bot picks up matched order
   b. Detects private settlement (lender_commitment != 0, lender = 0x0)
   c. Builds settle() calldata with lender_commitment in offer struct
   d. Executes on-chain — shares committed to privacy pool Merkle tree
   e. Order status: settled
```

---

## Browse & Lend — On-Chain Inscription (Direct)

**Page:** `/inscription/[id]`
**Actor:** Lender
**Gas cost:** approve + sign_inscription transaction

```
1. Lender navigates to /inscription/[id] page
   - Inscription must be status: open or partial

2. For single-lender: "Sign & Lend 100%" button
   For multi-lender: amount input with "Calculate BPS" auto-computation

3. Lender clicks sign button
   a. Build ERC20 approve calls for proportional debt amounts (bps / 10000)
   b. Build sign_inscription call via InscriptionClient
   c. Execute atomic multicall: [...approveCalls, signCall]

4. Wait for transaction confirmation
   - Toast with tx hash shown

5. POST /api/sync with tx_hash
   - Server waits for receipt, parses InscriptionSigned + TransferSingle events
   - Updates D1: inscription status (partial/filled), share balances, locker
   - Dispatches stela:sync event -> all useFetchApi hooks refetch

Inscription status: partial (if < 100%) or filled (if 100%)
ERC1155 shares minted to lender
```

---

## Repay Loan

**Page:** `/inscription/[id]`
**Actor:** Borrower
**Condition:** Inscription status = `filled`

```
1. Borrower navigates to inscription detail
   - InscriptionActions renders "Repay" button

2. Borrower clicks Repay
   a. Fetch assets from D1 (debt + interest)
   b. Build ERC20 approve calls for full debt + interest amounts
   c. Build repay() call via InscriptionClient
   d. Execute atomic multicall: [...approveCalls, repayCall]

3. Wait for confirmation
   - Toast with tx hash

4. POST /api/sync with tx_hash
   - Parses InscriptionRepaid event
   - Status: repaid

Borrower gets collateral back
Lenders can now redeem shares
```

---

## Liquidate Expired Loan

**Page:** `/inscription/[id]`
**Actor:** Anyone (after expiry)
**Condition:** Inscription status = `filled` AND `signed_at + duration < now`

```
1. User navigates to expired inscription
   - InscriptionActions renders "Liquidate" button with ConfirmDialog

2. User confirms liquidation
   a. Build liquidate() call via InscriptionClient (calldata: inscription_id as u256)
   b. Execute transaction

3. Wait for confirmation

4. POST /api/sync with tx_hash
   - Parses InscriptionLiquidated event
   - Status: liquidated

Collateral distributed to lenders (pro-rata by shares)
Bot also auto-liquidates on */2 cron
```

---

## Redeem Shares

**Page:** `/inscription/[id]`
**Actor:** Share holder
**Condition:** Inscription status = `repaid` or `liquidated` AND user has shares > 0

```
1. User navigates to inscription detail
   - useShares(id) reads balance_of from contract
   - InscriptionActions renders "Redeem" / "Claim" button

2. User clicks Redeem
   a. Build redeem() call with user's share amount via InscriptionClient
   b. Execute transaction

3. Wait for confirmation

4. POST /api/sync with tx_hash
   - Parses SharesRedeemed + TransferSingle events
   - Updates share_balances in D1

If repaid: user receives pro-rata debt + interest
If liquidated: user receives pro-rata collateral
```

---

## Cancel Order (Off-Chain)

**Page:** `/order/[id]`
**Actor:** Borrower (order owner)
**Condition:** Order status = `pending`

```
1. Borrower navigates to their pending order
   - "Cancel Order" button shown

2. Borrower clicks Cancel
   a. Build CancelOrder SNIP-12 typed data (getCancelOrderTypedData(orderId))
   b. Wallet prompts for signature (account.signMessage)
   c. DELETE /api/orders/:id with { borrower, signature }
   d. Server verifies: address matches, SNIP-12 signature valid on-chain

3. Order status: cancelled

No gas cost — only a signature
```

---

## Cancel Inscription (On-Chain)

**Page:** `/inscription/[id]`
**Actor:** Borrower (creator)
**Condition:** Inscription status = `open` (no lender has signed)

```
1. Borrower navigates to their open inscription
   - InscriptionActions renders "Cancel" button

2. Borrower clicks Cancel
   a. Build cancel_inscription() call via InscriptionClient
   b. Execute transaction

3. Wait for confirmation

4. POST /api/sync with tx_hash
   - Parses InscriptionCancelled event
   - Status: cancelled
```

---

## Batch Lending

**Page:** `/browse`
**Actor:** Lender
**Condition:** Multiple open inscriptions selected (max 10)

```
1. Lender enables batch mode on browse page
   - BatchSelectionProvider context manages selections
   - Checkboxes appear on InscriptionListRow components

2. Lender selects up to 10 open inscriptions
   - SelectionActionBar appears at bottom with count

3. Lender clicks "Review & Lend"
   - LendReviewModal opens showing all selected inscriptions

4. Lender confirms
   a. useBatchSign() hook aggregates:
      - Group all unique debt tokens across selected inscriptions
      - Build single approve call per token using U128_MAX (avoids per-inscription approvals)
      - Build sign_inscription call for each inscription (100% BPS)
   b. Execute single atomic multicall: [...approves, ...signCalls]

5. Wait for confirmation
   - All inscriptions signed in one transaction

6. POST /api/sync with tx_hash
   - Parses multiple InscriptionSigned + TransferSingle events
```

---

## Sync Bridge Flow (Internal)

After every on-chain transaction, the frontend immediately syncs:

```
1. Transaction confirmed on-chain
2. useSync() calls POST /api/sync with tx_hash
3. Server:
   a. provider.waitForTransaction(tx_hash) -- gets receipt
   b. Filter events from Stela contract address
   c. parseEvents() from SDK -- typed event parsing
   d. For each event: mirror indexer handler logic (upsert D1)
4. Server returns { ok: true, events: N }
5. Client dispatches 'stela:sync' CustomEvent on window
6. All useFetchApi() hooks listening for this event trigger refetch
7. UI updates immediately without waiting for Apibara indexer
```
