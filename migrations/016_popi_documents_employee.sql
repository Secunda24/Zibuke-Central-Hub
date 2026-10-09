-- Link each POPI vault document to the employee it belongs to.
-- popi_documents already exists (migration 014) with filename/content_type/size/object_key/
-- uploaded_by/created_at, so this only adds the employee link. Nullable on purpose: rows stored
-- before this change stay valid (they surface as "Unassigned"), and SQLite cannot add a NOT NULL
-- column without a default. New uploads require it at the API layer.
ALTER TABLE popi_documents ADD COLUMN employee_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS popi_documents_employee ON popi_documents(employee_id, created_at DESC);
