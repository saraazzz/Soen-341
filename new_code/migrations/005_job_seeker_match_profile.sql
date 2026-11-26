USE recruiting_website;

-- Preferences used by AI job matching. Skills, about, location, and resume
-- stay on the existing profile tables. Existing rows are not changed.
CREATE TABLE IF NOT EXISTS `job_seeker_match_profile` (
  `user_id` int NOT NULL,
  `education` text,
  `experience` text,
  `preferred_job_type` varchar(40) DEFAULT NULL,
  `preferred_location` varchar(255) DEFAULT NULL,
  `preferred_category` varchar(100) DEFAULT NULL,
  `preferences_note` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `job_seeker_match_profile_ibfk_1`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
