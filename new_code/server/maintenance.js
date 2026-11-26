const { timingSafeEqual } = require("crypto");
const { archiveExpiredPostings } = require("./deadline-archiver");

function createMaintenanceHandler(db, { secret, mysqlSessions = true }) {
    return async (req, res) => {
        res.set("Cache-Control", "no-store");
        if (!secret || Buffer.byteLength(secret) < 32) {
            return res.status(503).json({ message: "Maintenance is not configured." });
        }
        const expected = Buffer.from(`Bearer ${secret}`);
        const supplied = Buffer.from(req.get("authorization") || "");
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
            return res.status(401).json({ message: "Unauthorized." });
        }
        try {
            // These operations are safe to repeat if the scheduler retries.
            const archived = await archiveExpiredPostings(db);
            const expiredSessions = mysqlSessions ? await new Promise((resolve, reject) => {
                db.query("DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()", (error, result) => {
                    if (error) reject(error);
                    else resolve(result.affectedRows);
                });
            }) : 0;
            res.json({ archived, expiredSessions });
        } catch {
            res.status(503).json({ message: "Maintenance failed. Retry later." });
        }
    };
}

module.exports = { createMaintenanceHandler };
