const express = require("express");
const request = require("supertest");
const { createReadinessMiddleware } = require("../server/serverless-readiness");

function appFor(prepare) {
    const app = express();
    app.use(createReadinessMiddleware(prepare));
    app.get("/health/live", (req, res) => res.sendStatus(200));
    app.get("/api/example", (req, res) => res.json({ ok: true }));
    return app;
}

test("liveness stays available without contacting the database", async () => {
    const prepare = jest.fn();
    expect((await request(appFor(prepare)).get("/health/live")).status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
});

test("a failed cold-start check returns a safe error and retries next request", async () => {
    const prepare = jest.fn().mockRejectedValueOnce(new Error("private credentials"))
        .mockResolvedValue(undefined);
    const app = appFor(prepare);
    const first = await request(app).get("/api/example");
    expect(first.status).toBe(503);
    expect(first.text).not.toContain("private credentials");
    expect(first.headers["cache-control"]).toBe("no-store");
    expect((await request(app).get("/api/example")).status).toBe(200);
    expect((await request(app).get("/api/example")).status).toBe(200);
    expect(prepare).toHaveBeenCalledTimes(2);
});

test("concurrent requests wait for one shared readiness check", async () => {
    let finish;
    const prepare = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const middleware = createReadinessMiddleware(prepare);
    const next = jest.fn();
    const first = middleware({ path: "/api/example" }, {}, next);
    const second = middleware({ path: "/api/example" }, {}, next);
    await Promise.resolve();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    finish();
    await Promise.all([first, second]);
    expect(next).toHaveBeenCalledTimes(2);
});
