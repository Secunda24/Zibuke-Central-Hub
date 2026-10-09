-- Zibuke Central announcements upgrade.
-- Run once against an existing D1 database after 001_collaboration_upgrade.sql.

ALTER TABLE announcements ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE announcements ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE announcements ADD COLUMN audience_type TEXT NOT NULL DEFAULT 'company';
ALTER TABLE announcements ADD COLUMN audience_value TEXT;
ALTER TABLE announcements ADD COLUMN scheduled_at DATETIME;
ALTER TABLE announcements ADD COLUMN published_at DATETIME;
ALTER TABLE announcements ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN reactions_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE announcements ADD COLUMN require_acknowledgement INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN archived_at DATETIME;
ALTER TABLE announcements ADD COLUMN updated_at DATETIME;

UPDATE announcements
SET published_at = COALESCE(published_at, created_at),
    status = CASE WHEN status IS NULL OR status = '' THEN 'published' ELSE status END
WHERE published_at IS NULL OR status IS NULL OR status = '';

CREATE TABLE IF NOT EXISTS announcement_attachments (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','document')),
  slot TEXT NOT NULL DEFAULT 'attachment' CHECK (slot IN ('cover','attachment')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement ON announcement_attachments (announcement_id, created_at);

CREATE TABLE IF NOT EXISTS announcement_reactions (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (announcement_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_announcement ON announcement_reactions (announcement_id);

CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_announcement_ack_user ON announcement_acknowledgements (user_id, announcement_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements (status, published_at, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements (audience_type, audience_value);
