const test = require("node:test");
const assert = require("node:assert/strict");
const { readRuntimeConfig } = require("../server/runtime-config");
const { databaseOptions } = require("../server/database-options");
const production = { NODE_ENV: "production", SESSION_SECRET: "a".repeat(64) };

test("local HTTP development uses port 3000 and an ephemeral session secret", () => {
    const first = readRuntimeConfig({});
    assert.equal(first.port, 3000);
    assert.equal(first.sessionStore, "memory");
    assert.equal(first.cookie.secure, false);
    assert.notEqual(first.sessionSecret, readRuntimeConfig({}).sessionSecret);
});

test("production refuses missing/short secrets and memory sessions", () => {
    assert.throws(() => readRuntimeConfig({ NODE_ENV: "production" }), /SESSION_SECRET/);
    assert.throws(() => readRuntimeConfig({ ...production, SESSION_SECRET: "short" }), /SESSION_SECRET/);
    assert.throws(() => readRuntimeConfig({ ...production, SESSION_STORE: "memory" }), /requires mysql/);
});

test("production uses persistent sessions and HTTPS-only cookies", () => {
    const config = readRuntimeConfig({ ...production, PORT: "8080", TRUST_PROXY: "1" });
    assert.equal(config.port, 8080);
    assert.equal(config.sessionStore, "mysql");
    assert.equal(config.trustProxy, 1);
    assert.deepEqual(config.cookie, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 28800000 });
});

test("invalid ports and blanket proxy trust are rejected", () => {
    for (const PORT of ["0", "65536", "3.5", "3000x", "-1"]) {
        assert.throws(() => readRuntimeConfig({ PORT }), /PORT/);
    }
    assert.throws(() => readRuntimeConfig({ TRUST_PROXY: "true" }), /TRUST_PROXY/);
    assert.equal(readRuntimeConfig({ TRUST_PROXY: "loopback" }).trustProxy, "loopback");
});

test("hosted database TLS keeps certificate verification enabled", () => {
    const options = databaseOptions({ DB_HOST: "db.example", DB_USER: "app", DB_NAME: "career", DB_SSL: "true" });
    assert.equal(options.host, "db.example");
    assert.deepEqual(options.ssl, { rejectUnauthorized: true });
    assert.equal(databaseOptions({}).ssl, undefined);
    assert.throws(() => databaseOptions({ DB_SSL: "yes" }), /DB_SSL/);
    assert.throws(() => databaseOptions({ DB_SSL_CA_FILE: "certificate.pem" }), /requires DB_SSL/);
});
