CREATE TABLE agreements (
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

CREATE TABLE agreement_assets (
  agreement_id  TEXT NOT NULL REFERENCES agreements(id),
  asset_role    TEXT NOT NULL,
  asset_index   INTEGER NOT NULL,
  asset_address TEXT NOT NULL,
  asset_type    TEXT NOT NULL,
  value         TEXT,
  token_id      TEXT,
  PRIMARY KEY (agreement_id, asset_role, asset_index)
);

CREATE TABLE agreement_events (
  id            SERIAL PRIMARY KEY,
  agreement_id  TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  block_number  BIGINT NOT NULL,
  timestamp     BIGINT,
  data          JSONB
);

CREATE INDEX ON agreements(status);
CREATE INDEX ON agreements(creator);
CREATE INDEX ON agreements(borrower);
CREATE INDEX ON agreements(lender);
CREATE INDEX ON agreements(deadline);
