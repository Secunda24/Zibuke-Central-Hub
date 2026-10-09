-- Granular audience targeting for announcements (Department + Job Title).
-- Additive to the existing audience_type/audience_value model: the legacy clause stays in force
-- (ANDed in the read predicate) so announcements created before this change keep their original
-- audience, and the new columns can only narrow it further.
ALTER TABLE announcements ADD COLUMN target_department TEXT NOT NULL DEFAULT 'All';
ALTER TABLE announcements ADD COLUMN target_job_title TEXT NOT NULL DEFAULT 'All';

-- Bring pre-existing department-targeted rows into the new model so the two agree.
UPDATE announcements
   SET target_department = audience_value
 WHERE audience_type = 'department'
   AND audience_value IS NOT NULL
   AND TRIM(audience_value) <> '';

CREATE INDEX IF NOT EXISTS idx_announcements_targeting ON announcements (target_department, target_job_title);
