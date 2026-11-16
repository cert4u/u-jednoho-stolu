ALTER TABLE rooms ADD COLUMN invite_token TEXT;
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN invites_paused INTEGER NOT NULL DEFAULT 0 CHECK (invites_paused IN (0, 1));
