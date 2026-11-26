const express = require("express");
const application = require("./server/server");
const { createReadinessMiddleware } = require("./server/serverless-readiness");

// Vercel detects this root entry point and owns the HTTP listener. Database
// migrations run separately; a cold start only checks the session store.
const app = express();
app.use(createReadinessMiddleware(application.locals.prepareSessionStore));
app.use(application);
module.exports = app;
