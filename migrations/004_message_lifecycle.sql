-- Zibuke Central message lifecycle upgrade.
-- Run once after 001, 002 and 003.

ALTER TABLE messages ADD COLUMN reply_to_id TEXT;
ALTER TABLE messages ADD COLUMN edited_at DATETIME;
ALTER TABLE messages ADD COLUMN deleted_at DATETIME;

ALTER TABLE channel_messages ADD COLUMN edited_at DATETIME;
ALTER TABLE channel_messages ADD COLUMN deleted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages (deleted_at);
CREATE INDEX IF NOT EXISTS idx_channel_messages_deleted_at ON channel_messages (deleted_at);
