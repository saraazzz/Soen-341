// Notifications and reminders helper module for CareerConnect

function ensureNotificationsTable(db) {
    const tableSql = `
        CREATE TABLE IF NOT EXISTS notifications (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            type ENUM('new_application', 'status_update', 'interview_invite', 'job_offer', 'deadline_reminder') NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR(255) NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            CONSTRAINT notifications_ibfk_1
                FOREIGN KEY (user_id)
                REFERENCES users (id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `;
    db.query(tableSql, (err) => {
        if (err && err.code !== 'ER_TABLE_EXISTS_ERROR') {
            console.warn("Notice: notifications table check:", err.message);
        }
        // Ensure job_offer is in the ENUM if table was previously created
        db.query("ALTER TABLE notifications MODIFY COLUMN type ENUM('new_application', 'status_update', 'interview_invite', 'job_offer', 'deadline_reminder') NOT NULL", () => {});
    });

    // Safely check if deadline column exists in jobs
    const colSql = `
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'jobs'
          AND COLUMN_NAME = 'deadline'
    `;
    db.query(colSql, (err, rows) => {
        if (!err && rows && rows[0] && rows[0].count === 0) {
            db.query("ALTER TABLE jobs ADD COLUMN deadline DATE NULL DEFAULT NULL", () => {});
        }
    });
}

function createNotification(db, { userId, type, title, message, link }) {
    return new Promise((resolve, reject) => {
        if (!userId || !type || !title || !message || !link) {
            return reject(new Error("Missing required notification fields"));
        }

        const sql = `
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(sql, [userId, type, title, message, link], (err, result) => {
            if (err) {
                console.error("Error inserting notification:", err);
                return reject(err);
            }
            resolve(result);
        });
    });
}

function checkAndNotifyDeadlines(db, userId) {
    if (!userId) return;

    // Find jobs with an approaching deadline in the next 3 days
    // where user has not applied and has not been notified yet
    const sql = `
        SELECT jobs.id, jobs.title, jobs.company, jobs.deadline
        FROM jobs
        WHERE jobs.archived_at IS NULL
          AND jobs.deadline IS NOT NULL
          AND jobs.deadline >= CURDATE()
          AND jobs.deadline <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
          AND NOT EXISTS (
              SELECT 1 FROM applications
              WHERE applications.job_id = jobs.id
                AND applications.job_seeker_id = ?
          )
          AND NOT EXISTS (
              SELECT 1 FROM notifications
              WHERE notifications.user_id = ?
                AND notifications.type = 'deadline_reminder'
                AND notifications.link = CONCAT('job.html?id=', jobs.id)
          )
        LIMIT 5
    `;

    db.query(sql, [userId, userId], (err, jobs) => {
        if (err || !jobs || jobs.length === 0) return;

        jobs.forEach((job) => {
            const formattedDate = new Date(job.deadline).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });

            createNotification(db, {
                userId: userId,
                type: 'deadline_reminder',
                title: 'Application Deadline Approaching',
                message: `⏰ Reminder: Applications for ${job.title} at ${job.company} close soon (${formattedDate}). Apply now!`,
                link: `job.html?id=${job.id}`
            }).catch(() => {});
        });
    });
}

module.exports = {
    ensureNotificationsTable,
    createNotification,
    checkAndNotifyDeadlines
};

