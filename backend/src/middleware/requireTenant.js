/**
 * Hard guard — every multi-tenant route must verify req.user.companyId is set.
 *
 * Exception: SUPER_ADMIN role bypasses tenant check (no companyId in JWT).
 *
 * Without this, a JWT with a missing/null companyId would let conditional
 * filters short-circuit to an empty `where` clause and return rows across
 * every tenant in the system. Reject the request at the door instead.
 *
 * Apply AFTER `authenticate` and BEFORE any handler that touches tenanted data.
 */
module.exports = function requireTenant(req, res, next) {
  if (req.user?.role === 'SUPER_ADMIN') {
    return next();
  }
  if (!req.user || !req.user.companyId) {
    return res.status(401).json({
      error: 'Missing tenant context on token',
      code: 'NO_TENANT',
    });
  }
  next();
};

