-- Department targeting for the home "Command Center" updates feed.
-- Existing rows default to 'All'. Admins may target an update to one department;
-- standard employees only see updates targeted to 'All' or their own department.
ALTER TABLE updates ADD COLUMN target_department TEXT NOT NULL DEFAULT 'All';
