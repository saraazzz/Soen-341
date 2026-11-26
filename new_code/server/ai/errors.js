// Shared error type for AI features. Routes turn it into an HTTP response:
//   res.status(err.status).json({ error: err.message, code: err.code })
class AiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'AiError';
    this.code = code;     // short machine-readable reason, e.g. 'TIMEOUT'
    this.status = status; // HTTP status the route should answer with
  }
}

module.exports = { AiError };
