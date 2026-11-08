ALTER TABLE rooms ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX rooms_created_at ON rooms(created_at);
