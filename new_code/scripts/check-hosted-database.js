// Read-only deployment preflight. Uses the selected DB_* environment settings;
// never creates a database, applies migrations, or reads account/resume contents.
const mysql = require("mysql2/promise");
const { databaseOptions } = require("../server/database-options");

const checks = [
    ["accounts", "SELECT id, email, password, role FROM users LIMIT 0"],
    ["employer profiles", "SELECT user_id, company_name FROM employer_profiles LIMIT 0"],
    ["seeker profiles", "SELECT user_id, resume_path, address, postal_code FROM job_seeker_profiles LIMIT 0"],
    ["skills", "SELECT user_id, skill FROM job_seeker_skills LIMIT 0"],
    ["postings", "SELECT id, employer_id, archived_at, deadline, deadline_at FROM jobs LIMIT 0"],
    ["applications", "SELECT id, job_id, job_seeker_id, status, submitted_resume_file, submitted_resume_original_name, cover_letter_path FROM applications LIMIT 0"],
    ["notifications", "SELECT id, user_id, type, is_read FROM notifications LIMIT 0"],
    ["matching profiles", "SELECT user_id, education, experience, preferences_note FROM job_seeker_match_profile LIMIT 0"],
    ["resume builder", "SELECT id, title, template, data FROM resumes LIMIT 0"],
    ["sessions", "SELECT session_id, expires, data FROM sessions LIMIT 0"]
];

async function main() {
    const connection = await mysql.createConnection({ ...databaseOptions(), connectTimeout: 10000 });
    try {
        for (const [label, sql] of checks) {
            try {
                await connection.query({ sql, timeout: 10000 });
                console.log(`PASS: ${label}`);
            } catch (error) {
                console.error(`FAIL: ${label} (${error.code || "database error"})`);
                process.exitCode = 1;
            }
        }
        console.log("Preflight checks selected schema fields only. Run feature, ownership, and session-persistence tests separately.");
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error("Hosted database preflight failed:", error.code || error.name);
    process.exitCode = 1;
});
