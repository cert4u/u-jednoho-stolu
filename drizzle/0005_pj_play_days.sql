ALTER TABLE rooms ADD COLUMN last_play_day TEXT;
--> statement-breakpoint
CREATE TABLE pj_play_days (
  account_id TEXT NOT NULL REFERENCES pj_accounts(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  played_on TEXT NOT NULL,
  PRIMARY KEY (account_id, room_id, played_on)
);
--> statement-breakpoint
CREATE TRIGGER record_pj_play_day AFTER UPDATE OF last_play_day ON rooms
WHEN NEW.owner_id IS NOT NULL AND NEW.last_play_day IS NOT NULL
  AND NEW.last_play_day IS NOT OLD.last_play_day
BEGIN
  INSERT OR IGNORE INTO pj_play_days (account_id, room_id, played_on)
  VALUES (NEW.owner_id, NEW.id, NEW.last_play_day);
END;
