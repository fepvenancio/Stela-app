-- Off-chain order tables for SNIP-12 signature model

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  borrower TEXT NOT NULL COLLATE NOCASE,
  order_data TEXT NOT NULL,
  borrower_signature TEXT,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  debt_token TEXT COLLATE NOCASE,
  collateral_token TEXT COLLATE NOCASE,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS order_offers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  lender TEXT NOT NULL COLLATE NOCASE,
  bps INTEGER NOT NULL,
  lender_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_borrower ON orders(borrower);
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON orders(deadline);
CREATE INDEX IF NOT EXISTS idx_order_offers_order_id ON order_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_offers_lender ON order_offers(lender);
CREATE INDEX IF NOT EXISTS idx_order_offers_status ON order_offers(status);

-- Denormalized columns for instant-match queries (populated at order creation)
CREATE INDEX IF NOT EXISTS idx_orders_match ON orders(status, debt_token, collateral_token, duration_seconds);
-- Bot settlement queries
CREATE INDEX IF NOT EXISTS idx_orders_status_deadline ON orders(status, deadline);

CREATE INDEX IF NOT EXISTS idx_orders_pending_deadline ON orders(status, deadline);
CREATE INDEX IF NOT EXISTS idx_orders_match_deadline ON orders(status, debt_token, collateral_token, duration_seconds, deadline);
CREATE INDEX IF NOT EXISTS idx_orders_borrower_status ON orders(borrower, status);
CREATE INDEX IF NOT EXISTS idx_order_offers_lender_status ON order_offers(lender, status);
CREATE INDEX IF NOT EXISTS idx_order_offers_status_order_id ON order_offers(status, order_id);

-- ─── T1 Tables ──────────────────────────────────────────────────────────

-- Collection offers (T1-2): lender offers against any token in a collection
CREATE TABLE IF NOT EXISTS collection_offers (
  id TEXT PRIMARY KEY,
  lender TEXT NOT NULL COLLATE NOCASE,
  collection_address TEXT NOT NULL COLLATE NOCASE,
  order_data TEXT NOT NULL,
  lender_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  debt_token TEXT COLLATE NOCASE,
  collateral_token TEXT COLLATE NOCASE
);
CREATE INDEX IF NOT EXISTS idx_collection_offers_status ON collection_offers(status);
CREATE INDEX IF NOT EXISTS idx_collection_offers_collection ON collection_offers(collection_address, status);
CREATE INDEX IF NOT EXISTS idx_collection_offers_lender ON collection_offers(lender);

-- Collection offer acceptances (T1-2): borrower accepts with specific token_id
CREATE TABLE IF NOT EXISTS collection_offer_acceptances (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES collection_offers(id),
  borrower TEXT NOT NULL COLLATE NOCASE,
  token_id TEXT NOT NULL,
  borrower_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collection_acceptances_offer ON collection_offer_acceptances(offer_id);

-- Refinance offers (T1-1): new lender offers to refinance existing loan
CREATE TABLE IF NOT EXISTS refinance_offers (
  id TEXT PRIMARY KEY,
  inscription_id TEXT NOT NULL,
  new_lender TEXT NOT NULL COLLATE NOCASE,
  order_data TEXT NOT NULL,
  lender_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refinance_offers_inscription ON refinance_offers(inscription_id, status);
CREATE INDEX IF NOT EXISTS idx_refinance_offers_lender ON refinance_offers(new_lender);

-- Refinance approvals (T1-1): borrower approves refinance
CREATE TABLE IF NOT EXISTS refinance_approvals (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES refinance_offers(id),
  borrower TEXT NOT NULL COLLATE NOCASE,
  borrower_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refinance_approvals_offer ON refinance_approvals(offer_id);

-- Renegotiations (T1-4): propose new terms for existing loan
CREATE TABLE IF NOT EXISTS renegotiations (
  id TEXT PRIMARY KEY,
  inscription_id TEXT NOT NULL,
  proposer TEXT NOT NULL COLLATE NOCASE,
  proposal_data TEXT NOT NULL,
  proposer_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_renegotiations_inscription ON renegotiations(inscription_id, status);

-- Collateral sales (T1-5): buyer offers to purchase locked collateral
CREATE TABLE IF NOT EXISTS collateral_sales (
  id TEXT PRIMARY KEY,
  inscription_id TEXT NOT NULL,
  buyer TEXT NOT NULL COLLATE NOCASE,
  offer_data TEXT NOT NULL,
  borrower_signature TEXT NOT NULL,
  min_price TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collateral_sales_inscription ON collateral_sales(inscription_id, status);
