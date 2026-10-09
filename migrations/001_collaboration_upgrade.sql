-- Zibuke Central collaboration upgrade.
-- Run once against an existing D1 database.

ALTER TABLE events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'meeting';
ALTER TABLE events ADD COLUMN channel_id TEXT;
ALTER TABLE events ADD COLUMN online INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN recording_url TEXT;
ALTER TABLE events ADD COLUMN recording_duration_seconds INTEGER;
ALTER TABLE events ADD COLUMN cancelled_at DATETIME;

ALTER TABLE channel_messages ADD COLUMN reply_to_id TEXT;
ALTER TABLE channel_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'message';
ALTER TABLE channel_messages ADD COLUMN event_id TEXT;
ALTER TABLE channel_messages ADD COLUMN metadata_json TEXT;

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending','accepted','tentative','declined')),
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees (user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_events_channel ON events (channel_id, start_time);
CREATE INDEX IF NOT EXISTS idx_events_active ON events (cancelled_at, start_time);
CREATE INDEX IF NOT EXISTS idx_channel_messages_event ON channel_messages (event_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('direct','channel')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (target_type, target_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_target ON message_reactions (target_type, target_id);

CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('direct','channel')),
  target_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document','image','video','audio','link')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT,
  external_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_target ON message_attachments (target_type, target_id);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);