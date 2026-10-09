-- Soft delete (archive) for employees.
-- A hard DELETE FROM users cannot succeed: historical rows reference the account with no
-- ON DELETE action (events.organizer_id, messages.sender_id/receiver_id, channels.created_by,
-- channel_messages.sender_id, files.uploaded_by, announcements.author_id, all learning_*,
-- employee_internships, internship_history), so D1 aborts with FOREIGN KEY constraint failed.
-- Archiving keeps every record intact and is fully reversible:
--   UPDATE users SET archived_at = NULL WHERE id = '<id>';
ALTER TABLE users ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS users_archived ON users(archived_at);
