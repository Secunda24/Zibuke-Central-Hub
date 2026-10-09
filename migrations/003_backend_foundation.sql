-- Zibuke Central backend foundation.
-- Run once after 001_collaboration_upgrade.sql and 002_announcements_upgrade.sql.

ALTER TABLE channels ADD COLUMN visibility TEXT NOT NULL DEFAULT 'company';
ALTER TABLE channels ADD COLUMN archived_at DATETIME;

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner','member')),
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_at DATETIME,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members (user_id, channel_id);

INSERT OR IGNORE INTO channel_members (channel_id, user_id, member_role, joined_at)
SELECT id, created_by, 'owner', COALESCE(created_at, CURRENT_TIMESTAMP)
FROM channels;

INSERT OR IGNORE INTO channel_members (channel_id, user_id, member_role, joined_at)
SELECT channel_id, sender_id, 'member', MIN(created_at)
FROM channel_messages
GROUP BY channel_id, sender_id;

CREATE TABLE IF NOT EXISTS direct_read_state (
  user_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  last_read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, peer_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (peer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcement_views (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  first_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement ON announcement_views (announcement_id, last_viewed_at DESC);

ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN entity_type TEXT;
ALTER TABLE notifications ADD COLUMN entity_id TEXT;
ALTER TABLE notifications ADD COLUMN actor_id TEXT;
ALTER TABLE notifications ADD COLUMN metadata_json TEXT;
ALTER TABLE notifications ADD COLUMN read_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications (entity_type, entity_id);

ALTER TABLE events ADD COLUMN meeting_provider TEXT DEFAULT 'jitsi';
ALTER TABLE events ADD COLUMN meeting_room TEXT;

UPDATE events
SET meeting_room = 'zc-' || lower(hex(randomblob(8)))
WHERE online = 1 AND (meeting_room IS NULL OR meeting_room = '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_meeting_room ON events (meeting_room) WHERE meeting_room IS NOT NULL;
