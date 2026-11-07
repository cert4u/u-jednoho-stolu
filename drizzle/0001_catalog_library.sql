CREATE TABLE catalogs (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('local', 'community')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  source TEXT,
  installed_at TEXT NOT NULL,
  checked_at TEXT
);
CREATE TABLE catalog_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  source TEXT,
  saved_at TEXT NOT NULL
);
CREATE INDEX catalog_versions_catalog ON catalog_versions(catalog_id, id);
CREATE TABLE catalog_assets (
  digest TEXT PRIMARY KEY NOT NULL,
  bytes INTEGER NOT NULL,
  mime TEXT NOT NULL CHECK(mime = 'image/webp')
);
