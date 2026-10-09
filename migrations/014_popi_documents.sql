-- POPI compliance vault: metadata for documents held in the isolated
-- zibuke-popi-documents R2 bucket. uploaded_by is nullable on purpose — POPI
-- records are retained for compliance even if the uploader's account is removed.
CREATE TABLE IF NOT EXISTS popi_documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS popi_documents_created ON popi_documents(created_at DESC);
