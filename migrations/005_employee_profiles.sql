-- Private contact and identity details are only returned by the owner's profile API.
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
