const session = require("express-session");
const { databaseOptions } = require("./database-options");

function createSessionResources(config) {
    let store;
    let connection;
    if (config.sessionStore === "mysql") {
        const mysql = require("mysql2/promise");
        const MySQLStore = require("express-mysql-session")(session);
        connection = mysql.createPool({ ...databaseOptions(), connectionLimit: 2,
            ...(process.env.VERCEL === "1" ? { maxIdle: 0, idleTimeout: 1000 } : {}) });
        store = new MySQLStore({
            // Deployment applies deployment/sessions.sql explicitly. The app
            // must not silently change a teammate's database schema at login.
            createDatabaseTable: false,
            // Vercel can suspend the process between requests. Its authenticated
            // daily maintenance route performs cleanup instead of a timer.
            clearExpired: process.env.VERCEL !== "1",
            endConnectionOnClose: true,
            expiration: config.cookie.maxAge
        }, connection);
        store.on("error", () => console.error("Session storage failed; check database connectivity."));
    }
    return {
        middleware: session({
            name: "careerconnect.sid",
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: config.cookie,
            ...(store ? { store } : {})
        }),
        async ready() {
            if (!store) return;
            await store.onReady();
            // onReady alone does not verify the table when automatic creation is
            // disabled. Refuse startup if the deployment forgot the session SQL.
            await connection.query("SELECT session_id FROM sessions LIMIT 0");
        },
        async close() {
            if (store) await store.close();
        }
    };
}

function establishSession(req, res, userId, role, responseBody) {
    // Replace any previous session ID on login/registration, then wait for the
    // store before telling the browser it can open an authenticated page.
    req.session.regenerate((error) => {
        if (error) return res.status(503).json({ message: "Could not start your session. Please try logging in again." });
        req.session.userId = userId;
        req.session.role = role;
        req.session.save((saveError) => {
            if (saveError) return res.status(503).json({ message: "Could not save your session. Please try logging in again." });
            return res.json(responseBody);
        });
    });
}

module.exports = { createSessionResources, establishSession };
