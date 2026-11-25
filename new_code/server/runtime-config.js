const crypto = require("crypto");

function readRuntimeConfig(env = process.env) {
    const production = env.NODE_ENV === "production";
    const portText = env.PORT || "3000";
    const port = Number(portText);
    if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535.");
    }

    const secret = env.SESSION_SECRET;
    if (production && (!secret || Buffer.byteLength(secret, "utf8") < 32)) {
        throw new Error("Production requires SESSION_SECRET with at least 32 bytes; generate a random secret.");
    }
    const sessionStore = env.SESSION_STORE || (production ? "mysql" : "memory");
    if (!["memory", "mysql"].includes(sessionStore) || (production && sessionStore !== "mysql")) {
        throw new Error("SESSION_STORE must be memory or mysql; production requires mysql.");
    }

    // Trust forwarded HTTPS information only when the deployment explicitly names
    // its proxy hops/IP ranges. Never trust arbitrary client-supplied headers.
    const proxy = env.TRUST_PROXY || "0";
    if (["true", "false"].includes(proxy)) {
        throw new Error("TRUST_PROXY must be a hop count or explicit proxy IP/subnet list, not true/false.");
    }
    const trustProxy = /^\d+$/.test(proxy) ? Number(proxy) : proxy;
    if (typeof trustProxy === "number" && !Number.isSafeInteger(trustProxy)) {
        throw new Error("TRUST_PROXY hop count is too large.");
    }

    return {
        port,
        production,
        trustProxy,
        sessionStore,
        // Local development remains usable without extra setup. This ephemeral
        // secret deliberately logs local users out after a restart.
        sessionSecret: secret || crypto.randomBytes(32).toString("hex"),
        cookie: { httpOnly: true, secure: production, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
    };
}

module.exports = { readRuntimeConfig };
