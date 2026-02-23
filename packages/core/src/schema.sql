-- Stela D1 (SQLite) schema
-- Applied via Cloudflare MCP or wrangler d1 execute

CREATE TABLE IF NOT EXISTS inscriptions (
  id                      TEXT PRIMARY KEY,
  creator                 TEXT NOT NULL,
  borrower                TEXT,
  lender                  TEXT,
  status                  TEXT NOT NULL DEFAULT 'open',
  issued_debt_percentage  INTEGER NOT NULL DEFAULT 0,
  multi_lender            INTEGER NOT NULL DEFAULT 0,
  duration                INTEGER,
  deadline                INTEGER,
  signed_at               INTEGER,
  debt_asset_count        INTEGER,
  interest_asset_count    INTEGER,
  collateral_asset_count  INTEGER,
  created_at_block        INTEGER,
  created_at_ts           INTEGER,
  updated_at_ts           INTEGER
);

CREATE TABLE IF NOT EXISTS inscription_assets (
  inscription_id  TEXT NOT NULL REFERENCES inscriptions(id),
  asset_role      TEXT NOT NULL,
  asset_index     INTEGER NOT NULL,
  asset_address   TEXT NOT NULL,
  asset_type      TEXT NOT NULL,
  value           TEXT,
  token_id        TEXT,
  PRIMARY KEY (inscription_id, asset_role, asset_index)
);

CREATE TABLE IF NOT EXISTS inscription_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_number    INTEGER NOT NULL,
  timestamp       INTEGER,
  data            TEXT
);

CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inscriptions_status ON inscriptions(status);
CREATE INDEX IF NOT EXISTS idx_inscriptions_creator ON inscriptions(creator);
CREATE INDEX IF NOT EXISTS idx_inscriptions_borrower ON inscriptions(borrower);
CREATE INDEX IF NOT EXISTS idx_inscriptions_lender ON inscriptions(lender);
CREATE INDEX IF NOT EXISTS idx_inscriptions_deadline ON inscriptions(deadline);

INSERT OR IGNORE INTO _meta (key, value) VALUES ('last_block', '0');

CREATE TABLE IF NOT EXISTS lockers (
  inscription_id TEXT PRIMARY KEY,
  locker_address TEXT NOT NULL,
  created_at_ts  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lockers_address ON lockers(locker_address);

CREATE TABLE IF NOT EXISTS share_balances (
  account        TEXT NOT NULL,
  inscription_id TEXT NOT NULL,
  balance        TEXT NOT NULL DEFAULT '0',
  PRIMARY KEY (account, inscription_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_account ON share_balances(account);

-- Dedup index: prevents duplicate events from being inserted (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup ON inscription_events(inscription_id, event_type, tx_hash);
