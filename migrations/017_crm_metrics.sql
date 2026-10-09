-- Internal CRM skeleton: employee-logged tracking entries until head office confirms the final
-- CRM fields. employee_id references users(id) — there is no separate "employees" table.
-- metric_type is deliberately NOT constrained by a CHECK (the field set is expected to change);
-- it is validated in the API instead.
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
