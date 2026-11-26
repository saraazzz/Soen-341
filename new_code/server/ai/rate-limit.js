// Small in-memory per-user rate limiter (sliding window) for AI requests.
// Protects the shared Gemini free-tier quota. It resets when the server restarts,
// and it is per server process (fine for this project's single Node server).

function createRateLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map(); // key -> array of timestamps (ms) inside the window

  function recent(key, t) {
    return (hits.get(key) || []).filter((ts) => t - ts < windowMs);
  }

  return {
    max,
    windowMs,
    // Records one use if the user is under the limit.
    // Returns { allowed, remaining, retryAfterSec }.
    take(key) {
      const t = now();
      const list = recent(key, t);
      if (list.length >= max) {
        hits.set(key, list);
        return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000)) };
      }
      list.push(t);
      hits.set(key, list);
      if (hits.size > 1000) { // keep memory bounded: drop users with no recent hits
        for (const k of hits.keys()) if (recent(k, t).length === 0) hits.delete(k);
      }
      return { allowed: true, remaining: max - list.length, retryAfterSec: 0 };
    },
    reset() { hits.clear(); }
  };
}

module.exports = { createRateLimiter };
