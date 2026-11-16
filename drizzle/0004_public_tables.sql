CREATE TABLE pj_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('requested','invited','approved','rejected','suspended')),
  created_at INTEGER NOT NULL,
  verified_at INTEGER,
  approved_at INTEGER
);
--> statement-breakpoint
CREATE TABLE pj_signins (
  digest TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL UNIQUE REFERENCES pj_accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  issued_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE pj_sessions (
  digest TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES pj_accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE pj_admin_events (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES pj_accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  happened_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN owner_id TEXT REFERENCES pj_accounts(id);
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN last_activity_at INTEGER;
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN archived_at INTEGER;
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN warned_for_activity_at INTEGER;
--> statement-breakpoint
CREATE INDEX rooms_owner ON rooms(owner_id, archived_at);
--> statement-breakpoint
CREATE INDEX rooms_retention ON rooms(archived_at, last_activity_at) WHERE owner_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX pj_sessions_owner ON pj_sessions(account_id);
