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
