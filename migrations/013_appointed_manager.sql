-- The "Signaling Accounts Executives" sheets name an appointed manager per group.
-- Store it on the employee so the Directory can show e.g. "Signaling Accounts Executive (Manager: Siphe Gumede)".
ALTER TABLE users ADD COLUMN appointed_manager TEXT;
