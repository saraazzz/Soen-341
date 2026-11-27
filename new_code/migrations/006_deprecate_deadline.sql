-- CareerConnect: remove the unused deadline column from jobs.
-- jobs.deadline (DATE) was added by 004_create_notifications.sql but is never
-- read or written by the server. The server uses jobs.deadline_at (DATETIME)
-- added by 005_optional_posting_deadlines.sql for all deadline logic.
-- This migration removes deadline to avoid confusion between the two columns.
-- Existing jobs, applications, and deadline_at values are fully preserved.
-- SOURCE new_code/migrations/006_deprecate_deadline.sql;

USE recruiting_website;

SET @careerconnect_deadline_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'jobs'
      AND COLUMN_NAME = 'deadline'
);
SET @careerconnect_drop_sql = IF(
    @careerconnect_deadline_exists > 0,
    'ALTER TABLE `jobs` DROP COLUMN `deadline`',
    'SELECT ''deadline column not present; nothing to drop'' AS migration_note'
);

PREPARE careerconnect_drop_stmt FROM @careerconnect_drop_sql;
EXECUTE careerconnect_drop_stmt;
DEALLOCATE PREPARE careerconnect_drop_stmt;

-- Verify deadline_at is still present.
SHOW COLUMNS FROM jobs LIKE 'deadline_at';
