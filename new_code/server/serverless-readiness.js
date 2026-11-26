function createReadinessMiddleware(prepare) {
    let pending;
    return async (req, res, next) => {
        // Keep liveness useful even when the database is unavailable.
        if (req.path === "/health/live") return next();
        try {
            // Concurrent cold-start requests share one check. A failed check is
            // retried on the next request, so a temporary outage is recoverable.
            if (!pending) pending = Promise.resolve().then(prepare).catch(error => {
                pending = undefined;
                throw error;
            });
            await pending;
            next();
        } catch {
            res.set("Cache-Control", "no-store");
            res.status(503).json({ message: "Service temporarily unavailable. Please try again." });
        }
    };
}

module.exports = { createReadinessMiddleware };
