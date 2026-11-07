ALTER TABLE catalogs ADD COLUMN updated_at TEXT;
UPDATE catalogs SET updated_at = installed_at;
