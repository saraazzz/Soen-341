# Database Schema — CareerConnect

This document inventories every table and column in the database,
identifies where each piece was defined, and flags which definition
is authoritative.

---

## Table: `jobs`

**Authoritative definition:** `database.sql` (base) + migrations applied in order below.

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `database.sql` |
| `employer_id` | INT, FK → users | `database.sql` |
| `title` | VARCHAR | `database.sql` |
| `description` | TEXT | `database.sql` |
| `location` | VARCHAR | `database.sql` |
| `archived_at` | TIMESTAMP, nullable | `003_archive_job_postings.sql` |
| ~~`deadline`~~ | ~~DATE, nullable~~ | ~~Added by `004_create_notifications.sql`, removed by `006_deprecate_deadline.sql`~~ |
| `deadline_at` | DATETIME, nullable | `004_optional_posting_deadlines.sql` |

> `deadline` and `deadline_at` both exist on this table and serve overlapping
> purposes. The server uses `deadline_at` (see `posting-deadlines.js`).
> `deadline` appears unused in active code.
> `deadline` was removed by migration `006` because it was never used in active code.
> `deadline_at` is the authoritative deadline column.

---

## Table: `job_seeker_profiles`

**Authoritative definition:** `database.sql` (base) + migration 001.

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `database.sql` |
| `user_id` | INT, FK → users | `database.sql` |
| `bio` | TEXT | `database.sql` |
| `skills` | TEXT | `database.sql` |
| `resume_path` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `address` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `postal_code` | VARCHAR(20), nullable | `001_add_applications_and_resume_path.sql` |

## Table: `users`

**Authoritative definition:** `database.sql` (base, no migrations modify this table)

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `database.sql` |
| `email` | VARCHAR(255), NOT NULL | `database.sql` |
| `password` | VARCHAR(255), NOT NULL | `database.sql` |
| `role` | ENUM('job_seeker', 'employer'), NOT NULL | `database.sql` |
| `created_at` | TIMESTAMP, default CURRENT_TIMESTAMP | `database.sql` |

## Table: `applications`

**Authoritative definition:** `001_add_applications_and_resume_path.sql` (table created here) + migration 002.

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `001_add_applications_and_resume_path.sql` |
| `job_id` | INT, FK → jobs, NOT NULL | `001_add_applications_and_resume_path.sql` |
| `job_seeker_id` | INT, FK → users, NOT NULL | `001_add_applications_and_resume_path.sql` |
| `status` | ENUM('Applied','Under Review','Interview','Offered','Rejected'), default 'Applied' | `001_add_applications_and_resume_path.sql` |
| `cover_note` | TEXT, nullable | `001_add_applications_and_resume_path.sql` |
| `resume_path` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `cover_letter_path` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `first_name` | VARCHAR(100), nullable | `001_add_applications_and_resume_path.sql` |
| `last_name` | VARCHAR(100), nullable | `001_add_applications_and_resume_path.sql` |
| `email` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `phone` | VARCHAR(20), nullable | `001_add_applications_and_resume_path.sql` |
| `address` | VARCHAR(255), nullable | `001_add_applications_and_resume_path.sql` |
| `postal_code` | VARCHAR(20), nullable | `001_add_applications_and_resume_path.sql` |
| `linkedin_url` | VARCHAR(500), nullable | `001_add_applications_and_resume_path.sql` |
| `portfolio_url` | VARCHAR(500), nullable | `001_add_applications_and_resume_path.sql` |
| `work_authorization` | VARCHAR(40), nullable | `001_add_applications_and_resume_path.sql` |
| `availability_date` | DATE, nullable | `001_add_applications_and_resume_path.sql` |
| `salary_min` | DECIMAL(12,2), nullable | `001_add_applications_and_resume_path.sql` |
| `salary_max` | DECIMAL(12,2), nullable | `001_add_applications_and_resume_path.sql` |
| `salary_currency` | CHAR(3), NOT NULL, default 'CAD' | `001_add_applications_and_resume_path.sql` |
| `relevant_experience` | TEXT, nullable | `001_add_applications_and_resume_path.sql` |
| `submitted_resume_file` | VARCHAR(255), nullable | `002_link_submitted_application_resumes.sql` |
| `submitted_resume_original_name` | VARCHAR(255), nullable | `002_link_submitted_application_resumes.sql` |
| `applied_at` | TIMESTAMP, default CURRENT_TIMESTAMP | `001_add_applications_and_resume_path.sql` |
| `updated_at` | TIMESTAMP, auto-updates on change | `001_add_applications_and_resume_path.sql` |

## Table: `notifications`

**Authoritative definition:** `004_create_notifications.sql` (table created entirely by this migration, not in `database.sql`)

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `004_create_notifications.sql` |
| `user_id` | INT, FK → users, NOT NULL | `004_create_notifications.sql` |
| `type` | ENUM('new_application', 'status_update', 'interview_invite', 'job_offer', 'deadline_reminder'), NOT NULL | `004_create_notifications.sql` |
| `title` | VARCHAR(255), NOT NULL | `004_create_notifications.sql` |
| `message` | TEXT, NOT NULL | `004_create_notifications.sql` |
| `link` | VARCHAR(255), NOT NULL | `004_create_notifications.sql` |
| `is_read` | TINYINT(1), NOT NULL, default 0 | `004_create_notifications.sql` |
| `created_at` | TIMESTAMP, nullable, default CURRENT_TIMESTAMP | `004_create_notifications.sql` |

## Table: `resumes`

**Authoritative definition:** `db.js` startup (table created at server start, not in `database.sql`) + migration 007.

| Column | Type | Source |
|---|---|---|
| `id` | INT, PK, AUTO_INCREMENT | `db.js` |
| `user_id` | INT, FK → users, nullable | `007_add_resume_owner.sql` |
| `title` | VARCHAR(255), nullable | `db.js` |
| `template` | VARCHAR(50), default 'modern' | `db.js` |
| `data` | JSON, NOT NULL | `db.js` |
| `created_at` | TIMESTAMP, default CURRENT_TIMESTAMP | `db.js` |
| `updated_at` | TIMESTAMP, auto-updates on change | `db.js` |

> Records with `user_id = NULL` are orphaned (created before ownership was enforced).
> They are excluded from all queries and not accessible to any user.