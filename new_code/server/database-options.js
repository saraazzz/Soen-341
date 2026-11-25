const fs = require("fs");

// All three database clients (API, resume builder, sessions) must use the same
// database and TLS settings when the app moves from a laptop to a hosted service.
function databaseOptions(env = process.env) {
    const options = {
        host: env.DB_HOST || "127.0.0.1",
        port: Number(env.DB_PORT || 3306),
        user: env.DB_USER || "root",
        password: env.DB_PASSWORD || "",
        database: env.DB_NAME || "recruiting_website"
    };
    if (env.DB_SSL && !["true", "false"].includes(env.DB_SSL)) {
        throw new Error("DB_SSL must be true or false.");
    }
    if (env.DB_SSL_CA_FILE && env.DB_SSL !== "true") {
        throw new Error("DB_SSL_CA_FILE requires DB_SSL=true.");
    }
    if (env.DB_SSL === "true") {
        options.ssl = { rejectUnauthorized: true };
        if (env.DB_SSL_CA_FILE) options.ssl.ca = fs.readFileSync(env.DB_SSL_CA_FILE, "utf8");
    }
    return options;
}

module.exports = { databaseOptions };
