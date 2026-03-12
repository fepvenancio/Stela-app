-- Share listings: off-chain marketplace for secondary trading of lending positions
-- Sellers list their ERC1155 shares for sale; buyers fill listings on-chain via safeTransferFrom

CREATE TABLE IF NOT EXISTS share_listings (
  id                TEXT PRIMARY KEY,
  inscription_id    TEXT NOT NULL,
  seller            TEXT NOT NULL COLLATE NOCASE,
  shares            TEXT NOT NULL,
  payment_token     TEXT NOT NULL COLLATE NOCASE,
  price             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  deadline          INTEGER NOT NULL,
  created_at        INTEGER NOT NULL,
  filled_by         TEXT COLLATE NOCASE,
  filled_at         INTEGER,
  tx_hash           TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_listings_status ON share_listings(status);
CREATE INDEX IF NOT EXISTS idx_share_listings_inscription ON share_listings(inscription_id, status);
CREATE INDEX IF NOT EXISTS idx_share_listings_seller ON share_listings(seller, status);
CREATE INDEX IF NOT EXISTS idx_share_listings_deadline ON share_listings(status, deadline);
