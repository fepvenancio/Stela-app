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
