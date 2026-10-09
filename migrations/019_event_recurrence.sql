-- Recurring calendar events. One row = one series (editing/cancelling affects every occurrence).
-- recurrence_day: weekly = 0..6 (Sun..Sat, matching Date.getDay()); monthly = 1..31 (day of month).
-- recurrence_end_date: YYYY-MM-DD wall date, the last date an occurrence may start.
-- No CHECK on recurrence_type: validated in the API so the rule set can grow without a table rebuild.
ALTER TABLE events ADD COLUMN recurrence_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE events ADD COLUMN recurrence_day INTEGER;
ALTER TABLE events ADD COLUMN recurrence_end_date TEXT;

CREATE INDEX IF NOT EXISTS idx_events_recurrence ON events (recurrence_type, start_time);
