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

-- 1. Ensure the resumes table exists (for fresh/disposable DBs where the server hasn't created it yet)
CREATE TABLE IF NOT EXISTS `resumes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT DEFAULT NULL,
    `title` VARCHAR(255) DEFAULT NULL,
    `template` VARCHAR(50) DEFAULT 'modern',
    `data` JSON NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Add user_id column only if it does not already exist
SET @careerconnect_owner_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resumes'
      AND COLUMN_NAME = 'user_id'
);

SET @careerconnect_owner_sql = IF(
    @careerconnect_owner_exists = 0,
    'ALTER TABLE `resumes` ADD COLUMN `user_id` INT DEFAULT NULL',
    'SELECT ''resumes.user_id already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_owner_stmt FROM @careerconnect_owner_sql;
EXECUTE careerconnect_owner_stmt;
DEALLOCATE PREPARE careerconnect_owner_stmt;

-- 3. Add the foreign key constraint only if it does not already exist
SET @careerconnect_fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resumes'
      AND COLUMN_NAME = 'user_id'
      AND REFERENCED_TABLE_NAME = 'users'
);

SET @careerconnect_fk_sql = IF(
    @careerconnect_fk_exists = 0,
    'ALTER TABLE `resumes` ADD CONSTRAINT `resumes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
    'SELECT ''resumes.user_id foreign key already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_fk_stmt FROM @careerconnect_fk_sql;
EXECUTE careerconnect_fk_stmt;
DEALLOCATE PREPARE careerconnect_fk_stmt;

-- Verify the column and foreign key exist
SHOW COLUMNS FROM resumes LIKE 'user_id';
SHOW CREATE TABLE resumes;