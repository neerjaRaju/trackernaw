const crypto = require('crypto');

// Generates a per-request correlation ID and exposes it via res.set('X-Request-Id').
// Surfaces in error logs so we can trace one user action across services.
module.exports = function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.set('X-Request-Id', id);
  next();
};
