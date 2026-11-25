// Optional integration check: uses DB_* credentials to create and remove a new,
// randomly named test database. It never alters the configured application DB.
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const mysql = require("mysql2/promise");
const { databaseOptions } = require("../server/database-options");
const { readRuntimeConfig } = require("../server/runtime-config");
const { createSessionResources, establishSession } = require("../server/session-config");

async function main() {
    const testDatabase = "careerconnect_test_sessions_" + crypto.randomBytes(6).toString("hex");
    const originalDatabase = process.env.DB_NAME;
    const admin = await mysql.createConnection({ ...databaseOptions(), database: undefined, connectTimeout: 3000 });
    const resources = [];
    let created = false;
    try {
        await admin.query("CREATE DATABASE " + testDatabase);
        created = true;
        await admin.query("USE " + testDatabase);
        process.env.DB_NAME = testDatabase;
        const config = readRuntimeConfig({ SESSION_STORE: "mysql", SESSION_SECRET: crypto.randomBytes(32).toString("hex") });

        const missingTable = createSessionResources(config);
        resources.push(missingTable);
        await assert.rejects(missingTable.ready(), { code: "ER_NO_SUCH_TABLE" });
        await missingTable.close();
        resources.pop();
        await admin.query(fs.readFileSync(path.join(__dirname, "..", "deployment", "sessions.sql"), "utf8"));

        async function instance() {
            const store = createSessionResources(config);
            resources.push(store);
            await store.ready();
            const app = express();
            app.use(store.middleware);
            app.post("/login", (req, res) => establishSession(req, res, 42, "job_seeker", { ok: true }));
            app.get("/me", (req, res) => res.json({ userId: req.session.userId }));
            app.post("/logout", (req, res) => req.session.destroy(error => res.sendStatus(error ? 500 : 204)));
            return { app, store };
        }
        const first = await instance();
        const login = await request(first.app).post("/login");
        assert.equal(login.status, 200);
        const cookie = login.headers["set-cookie"][0].split(";")[0];
        await first.store.close();
        resources.pop();

        // A new store/pool has no in-memory knowledge of the first login.
        const restarted = await instance();
        const current = await request(restarted.app).get("/me").set("Cookie", cookie);
        assert.equal(current.body.userId, 42);
        assert.equal((await request(restarted.app).post("/logout").set("Cookie", cookie)).status, 204);
        const loggedOut = await request(restarted.app).get("/me").set("Cookie", cookie);
        assert.equal(loggedOut.body.userId, undefined);
        console.log("PASS: missing session table rejected; login survived a store restart; logout invalidated the saved session.");
    } finally {
        await Promise.all(resources.map(store => store.close()));
        if (originalDatabase === undefined) delete process.env.DB_NAME;
        else process.env.DB_NAME = originalDatabase;
        if (created) await admin.query("DROP DATABASE " + testDatabase);
        await admin.end();
    }
}

main().catch(error => {
    // Do not print connection details/passwords from driver errors.
    console.error("Session persistence check failed:", error.code || error.name);
    process.exitCode = 1;
});
