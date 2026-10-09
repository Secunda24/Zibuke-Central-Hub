-- Training: multi-file lessons + course audience targeting.
-- Additive only; run against existing databases that predate these columns/tables.
-- (Fresh installs get these from schema.sql.)

-- A lesson may now carry several files: one media (MP4/MP3) and a supporting document (PDF).
CREATE TABLE IF NOT EXISTS learning_lesson_files (
 id TEXT PRIMARY KEY,
 lesson_id TEXT NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('media','document')),
 storage_key TEXT NOT NULL,
 content_type TEXT NOT NULL,
 filename TEXT NOT NULL,
 size INTEGER NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS learning_lesson_files_lesson ON learning_lesson_files(lesson_id, kind, sort_order);

-- Remember who a course was aimed at, so "Manage courses" can display and prefill it.
ALTER TABLE learning_courses ADD COLUMN audience_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE learning_courses ADD COLUMN audience_value TEXT;
