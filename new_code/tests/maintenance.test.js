const express = require("express");
const request = require("supertest");
const { createMaintenanceHandler } = require("../server/maintenance");
const secret = "a".repeat(64);

function appFor(db, options = { secret }) {
    const app = express();
    app.get("/maintenance", createMaintenanceHandler(db, options));
    return app;
}

test.each([undefined, "short"])("unconfigured maintenance fails closed", async value => {
    const db = { query: jest.fn() };
    expect((await request(appFor(db, { secret: value })).get("/maintenance")).status).toBe(503);
    expect(db.query).not.toHaveBeenCalled();
});

test.each(["", "Bearer wrong", `Bearer ${"b".repeat(64)}`])("unauthorized maintenance never mutates the DB", async authorization => {
    const db = { query: jest.fn() };
    const result = await request(appFor(db)).get("/maintenance").set("Authorization", authorization);
    expect(result.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
});

test("authorized cleanup archives expired jobs and removes only expired sessions", async () => {
    const db = { query: jest.fn((sql, callback) => callback(null, { affectedRows: 2 })) };
    const result = await request(appFor(db)).get("/maintenance").set("Authorization", `Bearer ${secret}`);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ archived: 2, expiredSessions: 2 });
    expect(db.query.mock.calls[0][0]).toMatch(/archived_at IS NULL/);
    expect(db.query.mock.calls[1][0]).toBe("DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()");
    expect(result.headers["cache-control"]).toBe("no-store");
});

test("database failures are reported without leaking details", async () => {
    const db = { query: jest.fn((sql, cb) => cb(new Error("private database details"))) };
    const result = await request(appFor(db)).get("/maintenance").set("Authorization", `Bearer ${secret}`);
    expect(result.status).toBe(503);
    expect(result.text).not.toContain("private database details");
});

test("local memory-session cleanup does not require a sessions table", async () => {
    const db = { query: jest.fn((sql, cb) => cb(null, { affectedRows: 0 })) };
    const result = await request(appFor(db, { secret, mysqlSessions: false })).get("/maintenance")
        .set("Authorization", `Bearer ${secret}`);
    expect(result.status).toBe(200);
    expect(db.query).toHaveBeenCalledTimes(1);
});
