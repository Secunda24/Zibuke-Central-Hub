-- Stable folder IDs preserve access when display names change.
CREATE TABLE IF NOT EXISTS file_departments (id TEXT PRIMARY KEY COLLATE NOCASE, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
INSERT OR IGNORE INTO file_departments(id,name) VALUES ('General','General'),('Engineering','Engineering'),('HR','HR'),('Marketing','Marketing'),('Finance','Finance'),('Executive','Executive');
INSERT OR IGNORE INTO file_departments(id,name) SELECT DISTINCT department,department FROM files WHERE trim(department) <> '';
INSERT OR IGNORE INTO file_departments(id,name) SELECT DISTINCT department,department FROM users WHERE trim(department) <> '';
