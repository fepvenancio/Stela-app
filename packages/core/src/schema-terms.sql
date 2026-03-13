-- Terms of use agreement signatures (compliance proof)

CREATE TABLE IF NOT EXISTS terms_agreements (
  id              TEXT PRIMARY KEY,
  wallet_address  TEXT NOT NULL COLLATE NOCASE,
  signature_r     TEXT NOT NULL,
  signature_s     TEXT NOT NULL,
  message_hash    TEXT NOT NULL,
  terms_version   TEXT NOT NULL,
  terms_hash      TEXT NOT NULL,
  agreed_at       INTEGER NOT NULL,
  chain_id        TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terms_wallet ON terms_agreements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_terms_version ON terms_agreements(terms_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_wallet_version ON terms_agreements(wallet_address, terms_version);
