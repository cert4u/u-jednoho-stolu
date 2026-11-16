CREATE TABLE pj_email_changes (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES pj_accounts(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  target_email TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('self', 'recovery')),
  old_digest TEXT UNIQUE,
  new_digest TEXT UNIQUE,
  old_verified_at INTEGER,
  new_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
