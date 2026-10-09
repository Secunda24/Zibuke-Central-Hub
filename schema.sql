-- Fresh installation baseline, derived from read-only deployed schema on 2026-09-26.
-- Contains no employee data. Existing deployments: apply only unapplied migrations.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  department TEXT NOT NULL, -- Tracks which team they belong to
  id_document_path TEXT NOT NULL, -- THE COMPULSORY ID REQUIREMENT
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2_sha256' CHECK (password_algorithm = 'pbkdf2_sha256'),
  password_iterations INTEGER NOT NULL,
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, date_of_birth TEXT, otp TEXT, otp_expiry DATETIME, last_name TEXT, avatar_url TEXT, phone TEXT, job_title TEXT, appointed_manager TEXT, archived_at TEXT);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  organizer_id TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, event_type TEXT NOT NULL DEFAULT 'meeting', channel_id TEXT, online INTEGER NOT NULL DEFAULT 1, recording_url TEXT, recording_duration_seconds INTEGER, cancelled_at DATETIME, meeting_provider TEXT DEFAULT 'jitsi', meeting_room TEXT, recurrence_type TEXT NOT NULL DEFAULT 'none', recurrence_day INTEGER, recurrence_end_date TEXT,
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, reply_to_id TEXT, edited_at DATETIME, deleted_at DATETIME,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, visibility TEXT NOT NULL DEFAULT 'company', archived_at DATETIME,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, reply_to_id TEXT, message_type TEXT NOT NULL DEFAULT 'message', event_id TEXT, metadata_json TEXT, edited_at DATETIME, deleted_at DATETIME,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  department TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, category TEXT NOT NULL DEFAULT 'general', status TEXT NOT NULL DEFAULT 'published', audience_type TEXT NOT NULL DEFAULT 'company', audience_value TEXT, scheduled_at DATETIME, published_at DATETIME, pinned INTEGER NOT NULL DEFAULT 0, reactions_enabled INTEGER NOT NULL DEFAULT 1, require_acknowledgement INTEGER NOT NULL DEFAULT 0, archived_at DATETIME, updated_at DATETIME, target_department TEXT NOT NULL DEFAULT 'All', target_job_title TEXT NOT NULL DEFAULT 'All',
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, link TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, kind TEXT NOT NULL DEFAULT 'general', entity_type TEXT, entity_id TEXT, actor_id TEXT, metadata_json TEXT, read_at DATETIME);

CREATE TABLE IF NOT EXISTS updates (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, content TEXT NOT NULL, target_department TEXT NOT NULL DEFAULT 'All', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

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

CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS call_signals (id TEXT PRIMARY KEY, caller_id TEXT, caller_name TEXT, target_user_id TEXT, room_name TEXT, status TEXT DEFAULT 'ringing', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  personal_email TEXT,
  alternate_phone TEXT,
  identity_number TEXT,
  gender TEXT,
  city TEXT,
  province TEXT,
  start_date TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('id', 'other')),
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_id_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_by TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  document_id TEXT
);

CREATE TABLE IF NOT EXISTS employee_document_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  document_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_challenges (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 1
);

-- Additive only. Workbook proposals are not automatically applied to employees.
CREATE TABLE IF NOT EXISTS learning_positions (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, division TEXT NOT NULL, position_type TEXT NOT NULL,
 assessment_description TEXT NOT NULL DEFAULT '', assessment_type TEXT NOT NULL DEFAULT 'project' CHECK(assessment_type IN ('numeric','project')),
 assessment_target REAL, report_days TEXT NOT NULL DEFAULT '[]', report_format TEXT NOT NULL DEFAULT 'pdf' CHECK(report_format IN ('pdf','video')),
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(title,division)
);
CREATE TABLE IF NOT EXISTS learning_courses (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')), created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 audience_type TEXT NOT NULL DEFAULT 'all', audience_value TEXT
);
CREATE TABLE IF NOT EXISTS learning_sections (
 id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES learning_courses(id), title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS learning_lessons (
 id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES learning_courses(id), section_id TEXT REFERENCES learning_sections(id), title TEXT NOT NULL, content TEXT NOT NULL, resource_url TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
 kind TEXT NOT NULL DEFAULT 'text' CHECK(kind IN('text','video','document','external')), required INTEGER NOT NULL DEFAULT 1 CHECK(required IN(0,1)), duration_minutes INTEGER NOT NULL DEFAULT 0,
 storage_key TEXT, content_type TEXT
);
CREATE TABLE IF NOT EXISTS learning_lesson_files (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('media','document')), storage_key TEXT NOT NULL, content_type TEXT NOT NULL,
 filename TEXT NOT NULL, size INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS learning_lesson_files_lesson ON learning_lesson_files(lesson_id, kind, sort_order);
CREATE TABLE IF NOT EXISTS learning_position_courses (
 position_id TEXT NOT NULL REFERENCES learning_positions(id), course_id TEXT NOT NULL REFERENCES learning_courses(id), PRIMARY KEY(position_id,course_id)
);
CREATE TABLE IF NOT EXISTS learning_candidates (
 user_id TEXT PRIMARY KEY REFERENCES users(id), position_id TEXT NOT NULL REFERENCES learning_positions(id), candidate_group TEXT NOT NULL DEFAULT '', territory TEXT NOT NULL DEFAULT '', qualification TEXT NOT NULL DEFAULT '', institution TEXT NOT NULL DEFAULT '', start_date TEXT,
 assigned_by TEXT NOT NULL REFERENCES users(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS learning_assignments (
 user_id TEXT NOT NULL REFERENCES users(id), course_id TEXT NOT NULL REFERENCES learning_courses(id), required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)), due_date TEXT, started_at TEXT, assigned_by TEXT NOT NULL REFERENCES users(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS learning_progress (
 user_id TEXT NOT NULL REFERENCES users(id), lesson_id TEXT NOT NULL REFERENCES learning_lessons(id), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS learning_assessments (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), requirement_key TEXT NOT NULL, description TEXT NOT NULL, measurement_type TEXT NOT NULL CHECK(measurement_type IN ('numeric','project')), target REAL,
 progress REAL NOT NULL DEFAULT 0 CHECK(progress >= 0), started_at TEXT, completed_at TEXT, evidence TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, is_override INTEGER NOT NULL DEFAULT 0, assigned_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,requirement_key)
);
CREATE TABLE IF NOT EXISTS tracking_submissions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), due_date TEXT NOT NULL, evidence_url TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,due_date)
);
CREATE TABLE IF NOT EXISTS learning_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS learning_assessments_user ON learning_assessments(user_id);
CREATE TABLE IF NOT EXISTS learning_quizzes (
 id TEXT PRIMARY KEY, course_id TEXT NOT NULL UNIQUE REFERENCES learning_courses(id), title TEXT NOT NULL,
 pass_mark INTEGER NOT NULL CHECK(pass_mark BETWEEN 1 AND 100), required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)), questions TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS learning_quiz_attempts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), quiz_id TEXT NOT NULL REFERENCES learning_quizzes(id),
 score REAL NOT NULL, passed INTEGER NOT NULL CHECK(passed IN (0,1)), attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS quiz_attempt_user ON learning_quiz_attempts(user_id,quiz_id);
-- Freeze assigned course content, including quizzes, to preserve completed work.
CREATE TRIGGER IF NOT EXISTS freeze_assigned_lessons BEFORE INSERT ON learning_lessons
WHEN EXISTS(SELECT 1 FROM learning_assignments WHERE course_id=NEW.course_id)
BEGIN SELECT RAISE(ABORT,'Assigned courses are immutable'); END;
CREATE TRIGGER IF NOT EXISTS freeze_assigned_quizzes BEFORE INSERT ON learning_quizzes
WHEN EXISTS(SELECT 1 FROM learning_assignments WHERE course_id=NEW.course_id)
BEGIN SELECT RAISE(ABORT,'Assigned courses are immutable'); END;
-- Enforce eligibility again within the database write, closing concurrent-assignment races.
CREATE TRIGGER IF NOT EXISTS assessment_prerequisites BEFORE UPDATE OF progress,completed_at,started_at ON learning_assessments
WHEN EXISTS (
 SELECT 1 FROM learning_assignments a WHERE a.user_id=NEW.user_id AND a.required=1 AND (
 NOT EXISTS(SELECT 1 FROM learning_lessons l WHERE l.course_id=a.course_id AND l.required=1)
 OR EXISTS(SELECT 1 FROM learning_lessons l WHERE l.course_id=a.course_id AND l.required=1 AND NOT EXISTS(SELECT 1 FROM learning_progress p WHERE p.user_id=NEW.user_id AND p.lesson_id=l.id))
 OR EXISTS(SELECT 1 FROM learning_quizzes q WHERE q.course_id=a.course_id AND q.required=1 AND NOT EXISTS(SELECT 1 FROM learning_quiz_attempts t WHERE t.user_id=NEW.user_id AND t.quiz_id=q.id AND t.passed=1))
 ))
BEGIN SELECT RAISE(ABORT,'Training prerequisites outstanding'); END;
CREATE TRIGGER IF NOT EXISTS quiz_attempt_rate_limit BEFORE INSERT ON learning_quiz_attempts
WHEN (SELECT count(*) FROM learning_quiz_attempts WHERE user_id=NEW.user_id AND quiz_id=NEW.quiz_id AND attempted_at>datetime('now','-1 hour'))>=10
BEGIN SELECT RAISE(ABORT,'Quiz attempt limit reached'); END;

CREATE TABLE IF NOT EXISTS request_limits (
 key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
);

-- Stable folder IDs preserve access when display names change.
CREATE TABLE IF NOT EXISTS file_departments (id TEXT PRIMARY KEY COLLATE NOCASE, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
INSERT OR IGNORE INTO file_departments(id,name) VALUES ('General','General'),('Engineering','Engineering'),('HR','HR'),('Marketing','Marketing'),('Finance','Finance'),('Executive','Executive');
INSERT OR IGNORE INTO file_departments(id,name) SELECT DISTINCT department,department FROM files WHERE trim(department) <> '';
INSERT OR IGNORE INTO file_departments(id,name) SELECT DISTINCT department,department FROM users WHERE trim(department) <> '';

CREATE TABLE IF NOT EXISTS employee_internships (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','qualified')),
 started_at TEXT, target_date TEXT,
 source_reference TEXT NOT NULL DEFAULT '',
 qualified_at TEXT, qualified_by TEXT REFERENCES users(id), qualification_evidence TEXT,
 imported_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(status!='qualified' OR (qualified_at IS NOT NULL AND qualified_by IS NOT NULL AND length(trim(qualification_evidence))>0))
);
CREATE TABLE IF NOT EXISTS internship_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT (datetime('now')), actor_id TEXT REFERENCES users(id), evidence TEXT
);
CREATE TRIGGER IF NOT EXISTS internship_status_history AFTER UPDATE OF status ON employee_internships
WHEN OLD.status != NEW.status BEGIN
 INSERT INTO internship_history(user_id,status,actor_id,evidence) VALUES(NEW.user_id,NEW.status,NEW.qualified_by,NEW.qualification_evidence);
END;

-- POPI compliance vault: metadata for documents held in the isolated zibuke-popi-documents
-- R2 bucket. uploaded_by is nullable on purpose so POPI records survive account removal.
CREATE TABLE IF NOT EXISTS popi_documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  employee_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS popi_documents_created ON popi_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS popi_documents_employee ON popi_documents(employee_id, created_at DESC);

-- Internal CRM skeleton: employee-logged tracking entries until head office confirms the final
-- CRM fields. metric_type is intentionally unconstrained so the field set can change freely.
CREATE TABLE IF NOT EXISTS crm_metrics (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES users(id),
  metric_type TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS crm_metrics_employee ON crm_metrics(employee_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS crm_metrics_type ON crm_metrics(metric_type);
