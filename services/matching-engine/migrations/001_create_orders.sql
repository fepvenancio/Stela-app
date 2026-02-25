CREATE TABLE signed_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_hash       TEXT NOT NULL UNIQUE,
  maker            TEXT NOT NULL,
  allowed_taker    TEXT NOT NULL DEFAULT '0x0',
  inscription_id   TEXT NOT NULL,
  bps              TEXT NOT NULL,
  deadline         BIGINT NOT NULL,
  nonce            TEXT NOT NULL,
  min_fill_bps     TEXT NOT NULL DEFAULT '0',
  signature_r      TEXT NOT NULL,
  signature_s      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','reserved','soft_cancelled','cancelled','filled','expired')),
  filled_bps       TEXT NOT NULL DEFAULT '0',
  reserved_until   TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signed_orders_maker ON signed_orders(maker);
CREATE INDEX idx_signed_orders_status ON signed_orders(status);
CREATE INDEX idx_signed_orders_inscription_id ON signed_orders(inscription_id);
CREATE INDEX idx_signed_orders_deadline ON signed_orders(deadline);
CREATE INDEX idx_signed_orders_order_hash ON signed_orders(order_hash);
