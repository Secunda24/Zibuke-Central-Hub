-- Additive only. Workbook proposals are not automatically applied to employees.
CREATE TABLE IF NOT EXISTS learning_positions (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, division TEXT NOT NULL, position_type TEXT NOT NULL,
 assessment_description TEXT NOT NULL DEFAULT '', assessment_type TEXT NOT NULL DEFAULT 'project' CHECK(assessment_type IN ('numeric','project')),
 assessment_target REAL, report_days TEXT NOT NULL DEFAULT '[]', report_format TEXT NOT NULL DEFAULT 'pdf' CHECK(report_format IN ('pdf','video')),
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(title,division)
);
CREATE TABLE IF NOT EXISTS learning_courses (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')), created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS learning_sections (
 id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES learning_courses(id), title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS learning_lessons (
 id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES learning_courses(id), section_id TEXT REFERENCES learning_sections(id), title TEXT NOT NULL, content TEXT NOT NULL, resource_url TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
 kind TEXT NOT NULL DEFAULT 'text' CHECK(kind IN('text','video','document','external')), required INTEGER NOT NULL DEFAULT 1 CHECK(required IN(0,1)), duration_minutes INTEGER NOT NULL DEFAULT 0,
 storage_key TEXT, content_type TEXT
);
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
