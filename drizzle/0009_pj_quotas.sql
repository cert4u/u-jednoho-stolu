ALTER TABLE pj_accounts ADD COLUMN table_limit INTEGER CHECK (table_limit > 0);
--> statement-breakpoint
ALTER TABLE pj_accounts ADD COLUMN bytes_limit INTEGER CHECK (bytes_limit > 0);
