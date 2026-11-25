-- CareerConnect: add ownership to resume-builder records.
-- The resumes table was created without a user_id column, making every resume
-- accessible to any user. This migration adds user_id as a nullable foreign key
-- to users(id). NULL means the record is orphaned (created before ownership was
-- enforced); orphaned records are excluded from all queries by the application.
-- From the repository root, open MySQL, then run:
-- SOURCE new_code/migrations/007_add_resume_owner.sql;
--
-- Existing resume records are preserved with user_id = NULL.
-- No records are deleted or reassigned.

USE recruiting_website;

SET @careerconnect_owner_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resumes'
      AND COLUMN_NAME = 'user_id'
);

SET @careerconnect_owner_sql = IF(
    @careerconnect_owner_exists = 0,
    'ALTER TABLE `resumes` ADD COLUMN `user_id` INT DEFAULT NULL, ADD CONSTRAINT `resumes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
    'SELECT ''user_id already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_owner_stmt FROM @careerconnect_owner_sql;
EXECUTE careerconnect_owner_stmt;
DEALLOCATE PREPARE careerconnect_owner_stmt;

-- Verify the column was added.
SHOW COLUMNS FROM resumes LIKE 'user_id';