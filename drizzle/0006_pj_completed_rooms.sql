CREATE TABLE pj_completed_rooms (
  account_id TEXT NOT NULL REFERENCES pj_accounts(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  completed_on TEXT NOT NULL,
  PRIMARY KEY (account_id, room_id)
);
