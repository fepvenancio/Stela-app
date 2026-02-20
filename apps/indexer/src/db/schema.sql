CREATE TABLE inscriptions (
  id                      TEXT PRIMARY KEY,
  creator                 TEXT NOT NULL,
  borrower                TEXT,
  lender                  TEXT,
  status                  TEXT NOT NULL DEFAULT 'open',
  issued_debt_percentage  BIGINT NOT NULL DEFAULT 0,
  multi_lender            BOOLEAN NOT NULL DEFAULT FALSE,
  duration                BIGINT,
  deadline                BIGINT,
  signed_at               BIGINT,
  debt_asset_count        INTEGER,
  interest_asset_count    INTEGER,
  collateral_asset_count  INTEGER,
  created_at_block        BIGINT,
  created_at_ts           BIGINT,
  updated_at_ts           BIGINT
);

CREATE TABLE inscription_assets (
  inscription_id  TEXT NOT NULL REFERENCES inscriptions(id),
  asset_role    TEXT NOT NULL,
  asset_index   INTEGER NOT NULL,
  asset_address TEXT NOT NULL,
  asset_type    TEXT NOT NULL,
  value         TEXT,
  token_id      TEXT,
  PRIMARY KEY (inscription_id, asset_role, asset_index)
);

CREATE TABLE inscription_events (
  id            SERIAL PRIMARY KEY,
  inscription_id  TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  block_number  BIGINT NOT NULL,
  timestamp     BIGINT,
  data          JSONB
);

CREATE INDEX ON inscriptions(status);
CREATE INDEX ON inscriptions(creator);
CREATE INDEX ON inscriptions(borrower);
CREATE INDEX ON inscriptions(lender);
CREATE INDEX ON inscriptions(deadline);
