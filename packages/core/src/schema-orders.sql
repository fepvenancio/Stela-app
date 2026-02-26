-- Off-chain order tables for SNIP-12 signature model

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  borrower TEXT NOT NULL,
  order_data TEXT NOT NULL,
  borrower_signature TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_offers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  lender TEXT NOT NULL,
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
