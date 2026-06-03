const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');

router.use(authenticate, requireTenant, authorize('COMPANY_ADMIN', 'SUPER_ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const { userId, action, entityType, from, to, page = 1, pageSize = 50 } = req.query;
    const where = { companyId: req.user.companyId };
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const take = Math.min(Number(pageSize), 200);
    const skip = (Math.max(1, Number(page)) - 1) * take;

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    ]);

    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json({
      total, page: Number(page), pageSize: take,
      rows: rows.map((r) => ({ ...r, user: r.userId ? userMap[r.userId] || null : null })),
    });
  } catch (e) { next(e); }
});

// Distinct action names for filter dropdown. Use $queryRaw (parameter-bound),
// never $queryRawUnsafe with string interpolation — even when the value
// comes from a JWT (defense in depth + clean VAPT scans).
router.get('/actions', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT action FROM "AuditLog"
      WHERE "companyId" = ${req.user.companyId}
      ORDER BY action`;
    res.json(rows.map((r) => r.action));
  } catch (e) { next(e); }
});

module.exports = router;
