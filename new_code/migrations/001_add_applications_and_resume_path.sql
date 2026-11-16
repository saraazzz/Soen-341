-- CareerConnect: update older local databases without deleting records.
-- Requires MySQL 8.0+ and the existing users, jobs, and job_seeker_profiles tables.
-- Back up important local data first. Run with an account permitted to CREATE/ALTER.
-- From the repository root, open MySQL, then run:
-- SOURCE new_code/migrations/001_add_applications_and_resume_path.sql;
--
-- Adds missing profile/application fields while preserving existing records.
-- No sample data is inserted. No tables or records are dropped.

USE recruiting_website;

-- MySQL does not support ADD COLUMN IF NOT EXISTS; inspect metadata instead.
SET @careerconnect_resume_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'job_seeker_profiles'
      AND COLUMN_NAME = 'resume_path'
);

SET @careerconnect_resume_sql = IF(
    @careerconnect_resume_exists = 0,
    'ALTER TABLE `job_seeker_profiles` ADD COLUMN `resume_path` VARCHAR(255) DEFAULT NULL',
    'SELECT ''resume_path already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_resume_statement FROM @careerconnect_resume_sql;
EXECUTE careerconnect_resume_statement;
DEALLOCATE PREPARE careerconnect_resume_statement;

SET @careerconnect_profile_additions = CONCAT(
    IF(
        (SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_seeker_profiles'
           AND COLUMN_NAME = 'address') = 0,
        ', ADD COLUMN `address` VARCHAR(255) DEFAULT NULL',
        ''
    ),
    IF(
        (SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_seeker_profiles'
           AND COLUMN_NAME = 'postal_code') = 0,
        ', ADD COLUMN `postal_code` VARCHAR(20) DEFAULT NULL',
        ''
    )
);
SET @careerconnect_profile_sql = IF(
    @careerconnect_profile_additions = '',
    'SELECT ''job seeker address fields already exist'' AS migration_note',
    CONCAT('ALTER TABLE `job_seeker_profiles` ', SUBSTRING(@careerconnect_profile_additions, 3))
);
PREPARE careerconnect_profile_statement FROM @careerconnect_profile_sql;
EXECUTE careerconnect_profile_statement;
DEALLOCATE PREPARE careerconnect_profile_statement;

-- Same definition as database.sql, with a guard for teammates who added it already.
CREATE TABLE IF NOT EXISTS `applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `job_seeker_id` int NOT NULL,
  `status` enum('Applied','Under Review','Interview','Offered','Rejected') NOT NULL DEFAULT 'Applied',
  `cover_note` text,
  `resume_path` varchar(255) DEFAULT NULL,
  `cover_letter_path` varchar(255) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `linkedin_url` varchar(500) DEFAULT NULL,
  `portfolio_url` varchar(500) DEFAULT NULL,
  `work_authorization` varchar(40) DEFAULT NULL,
  `availability_date` date DEFAULT NULL,
  `salary_min` decimal(12,2) DEFAULT NULL,
  `salary_max` decimal(12,2) DEFAULT NULL,
  `salary_currency` char(3) NOT NULL DEFAULT 'CAD',
  `relevant_experience` text,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_application` (`job_id`,`job_seeker_id`),
  KEY `job_seeker_id` (`job_seeker_id`),
  CONSTRAINT `applications_ibfk_1`
    FOREIGN KEY (`job_id`)
    REFERENCES `jobs` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `applications_ibfk_2`
    FOREIGN KEY (`job_seeker_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add the column to existing applications tables too; CREATE TABLE IF NOT EXISTS
-- does not update tables that were created by an earlier version of this migration.
SET @careerconnect_application_resume_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'applications'
      AND COLUMN_NAME = 'resume_path'
);

SET @careerconnect_application_resume_sql = IF(
    @careerconnect_application_resume_exists = 0,
    'ALTER TABLE `applications` ADD COLUMN `resume_path` VARCHAR(255) DEFAULT NULL',
    'SELECT ''applications.resume_path already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_application_resume_statement FROM @careerconnect_application_resume_sql;
EXECUTE careerconnect_application_resume_statement;
DEALLOCATE PREPARE careerconnect_application_resume_statement;

SET @careerconnect_cover_letter_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'applications'
      AND COLUMN_NAME = 'cover_letter_path'
);
SET @careerconnect_cover_letter_sql = IF(
    @careerconnect_cover_letter_exists = 0,
    'ALTER TABLE `applications` ADD COLUMN `cover_letter_path` VARCHAR(255) DEFAULT NULL',
    'SELECT ''applications.cover_letter_path already exists; left unchanged'' AS migration_note'
);
PREPARE careerconnect_cover_letter_statement FROM @careerconnect_cover_letter_sql;
EXECUTE careerconnect_cover_letter_statement;
DEALLOCATE PREPARE careerconnect_cover_letter_statement;

SET @careerconnect_application_additions = CONCAT(
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'first_name') = 0,
       ', ADD COLUMN `first_name` VARCHAR(100) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'last_name') = 0,
       ', ADD COLUMN `last_name` VARCHAR(100) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'email') = 0,
       ', ADD COLUMN `email` VARCHAR(255) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'phone') = 0,
       ', ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'address') = 0,
       ', ADD COLUMN `address` VARCHAR(255) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'postal_code') = 0,
       ', ADD COLUMN `postal_code` VARCHAR(20) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'linkedin_url') = 0,
       ', ADD COLUMN `linkedin_url` VARCHAR(500) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'portfolio_url') = 0,
       ', ADD COLUMN `portfolio_url` VARCHAR(500) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'work_authorization') = 0,
       ', ADD COLUMN `work_authorization` VARCHAR(40) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'availability_date') = 0,
       ', ADD COLUMN `availability_date` DATE DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'salary_min') = 0,
       ', ADD COLUMN `salary_min` DECIMAL(12,2) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'salary_max') = 0,
       ', ADD COLUMN `salary_max` DECIMAL(12,2) DEFAULT NULL', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'salary_currency') = 0,
       ', ADD COLUMN `salary_currency` CHAR(3) NOT NULL DEFAULT ''CAD''', ''),
    IF((SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
          AND COLUMN_NAME = 'relevant_experience') = 0,
       ', ADD COLUMN `relevant_experience` TEXT', '')
);
SET @careerconnect_application_sql = IF(
    @careerconnect_application_additions = '',
    'SELECT ''application details fields already exist'' AS migration_note',
    CONCAT('ALTER TABLE `applications` ', SUBSTRING(@careerconnect_application_additions, 3))
);
PREPARE careerconnect_application_statement FROM @careerconnect_application_sql;
EXECUTE careerconnect_application_statement;
DEALLOCATE PREPARE careerconnect_application_statement;

-- Verify the added fields.
SHOW COLUMNS FROM job_seeker_profiles LIKE 'resume_path';
SHOW COLUMNS FROM job_seeker_profiles LIKE 'address';
SHOW COLUMNS FROM job_seeker_profiles LIKE 'postal_code';
SHOW COLUMNS FROM applications LIKE 'resume_path';
SHOW COLUMNS FROM applications LIKE 'cover_letter_path';
SHOW COLUMNS FROM applications LIKE 'first_name';
SHOW COLUMNS FROM applications LIKE 'salary_min';
SHOW CREATE TABLE applications;
