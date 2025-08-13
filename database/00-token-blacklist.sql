-- Token blacklist table used by middleware/auth.js
CREATE TABLE IF NOT EXISTS token_blacklist (
  token TEXT PRIMARY KEY,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist (expires_at);


