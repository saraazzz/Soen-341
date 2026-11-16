USE recruiting_website;

-- Migration 004: Create notifications table and add optional deadline column to jobs
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `type` ENUM('new_application', 'status_update', 'interview_invite', 'job_offer', 'deadline_reminder') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `link` VARCHAR(255) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Safely add deadline to jobs if not present
SET @careerconnect_deadline_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'jobs'
      AND COLUMN_NAME = 'deadline'
);

SET @careerconnect_deadline_sql = IF(
    @careerconnect_deadline_exists = 0,
    'ALTER TABLE `jobs` ADD COLUMN `deadline` DATE NULL DEFAULT NULL',
    'SELECT \'deadline column already exists; left unchanged\' AS migration_note'
);
PREPARE careerconnect_deadline_stmt FROM @careerconnect_deadline_sql;
EXECUTE careerconnect_deadline_stmt;
DEALLOCATE PREPARE careerconnect_deadline_stmt;
