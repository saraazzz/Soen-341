-- Run against the selected CareerConnect database before SESSION_STORE=mysql.
-- Separate from numbered feature migrations to avoid taking Angelina's next number.
-- This creates only the session table and preserves existing application records.
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id),
    KEY sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
