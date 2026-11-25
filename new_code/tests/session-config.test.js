const express = require("express");
const request = require("supertest");
const { readRuntimeConfig } = require("../server/runtime-config");
const { createSessionResources, establishSession } = require("../server/session-config");

function sessionApp(overrides = {}) {
    const config = readRuntimeConfig({ SESSION_SECRET: "test-secret-for-isolated-tests", ...overrides });
    const resources = createSessionResources(config);
    const app = express();
    app.set("trust proxy", config.trustProxy);
    app.use(resources.middleware);
    app.get("/before-login", (req, res) => { req.session.marker = "old"; res.json({ id: req.sessionID }); });
    app.post("/login", (req, res) => establishSession(req, res, 42, "job_seeker", { ok: true }));
    app.get("/me", (req, res) => res.json({ id: req.sessionID, userId: req.session.userId, marker: req.session.marker }));
    app.post("/logout", (req, res) => req.session.destroy(() => res.sendStatus(204)));
    return app;
}

test("login replaces the previous session, persists identity, and logout removes it", async () => {
    const agent = request.agent(sessionApp());
    const before = await agent.get("/before-login");
    const loggedIn = await agent.post("/login");
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(loggedIn.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    const after = await agent.get("/me");
    expect(after.body.userId).toBe(42);
    expect(after.body.id).not.toBe(before.body.id);
    expect(after.body.marker).toBeUndefined();
    await agent.post("/logout");
    expect((await agent.get("/me")).body.userId).toBeUndefined();
});

test("secure cookies work behind an explicitly trusted HTTPS proxy", async () => {
    const config = readRuntimeConfig({ SESSION_SECRET: "test-secret", TRUST_PROXY: "1" });
    config.cookie.secure = true;
    const app = express();
    app.set("trust proxy", config.trustProxy);
    app.use(createSessionResources(config).middleware);
    app.post("/login", (req, res) => establishSession(req, res, 42, "job_seeker", { ok: true }));
    expect((await request(app).post("/login")).headers["set-cookie"]).toBeUndefined();
    const response = await request(app).post("/login").set("X-Forwarded-Proto", "https");
    expect(response.headers["set-cookie"][0]).toMatch(/; Secure/);
});

test.each(["regenerate", "save"])("session %s failure does not claim login success", (failure) => {
    const req = { session: {
        regenerate: cb => cb(failure === "regenerate" ? new Error("offline") : null),
        save: cb => cb(failure === "save" ? new Error("offline") : null)
    } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    establishSession(req, res, 42, "job_seeker", { ok: true });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).not.toHaveBeenCalledWith({ ok: true });
});
