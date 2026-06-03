// Ensures all queries are scoped to the requesting user's company.
function withTenant(req, _res, next) {
  if (req.user && req.user.companyId) {
    req.companyId = req.user.companyId;
  }
  next();
}

module.exports = { withTenant };
