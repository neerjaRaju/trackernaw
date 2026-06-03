const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');

router.use(authenticate, requireTenant, authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'));

router.get('/summary', async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalEmployees, presentToday, openTasks, pendingExpenses, todayOrders] = await Promise.all([
      prisma.user.count({ where: { companyId, isActive: true } }),
      prisma.attendance.count({ where: { companyId, date: today, checkInAt: { not: null } } }),
      prisma.task.count({ where: { companyId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.expense.count({ where: { companyId, status: 'SUBMITTED' } }),
      prisma.order.count({ where: { companyId, createdAt: { gte: today } } }),
    ]);

    res.json({
      totalEmployees, presentToday,
      attendanceRate: totalEmployees ? Math.round((presentToday / totalEmployees) * 100) : 0,
      openTasks, pendingExpenses, todayOrders,
    });
  } catch (e) { next(e); }
});

// Heatmap — bucket pings into a coarse grid. Use $queryRaw (parameter-bound)
// for both companyId and the time window — never $queryRawUnsafe + string
// concatenation, even with values from the JWT (defense in depth, clean VAPT).
router.get('/heatmap', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 3600_000);
    const rows = await prisma.$queryRaw`
      SELECT
        ROUND(lat::numeric, 3) AS lat,
        ROUND(lng::numeric, 3) AS lng,
        COUNT(*)::int AS weight
      FROM "LocationPing" lp
      JOIN "User" u ON u.id = lp."userId"
      WHERE lp."recordedAt" >= ${since}
        AND u."companyId" = ${req.user.companyId}
      GROUP BY 1, 2
      ORDER BY weight DESC
      LIMIT 5000`;
    res.json(rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), weight: r.weight })));
  } catch (e) { next(e); }
});

router.get('/attendance-trend', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT date::date AS day, COUNT(*) FILTER (WHERE "checkInAt" IS NOT NULL) AS present
      FROM "Attendance"
      WHERE date >= NOW() - INTERVAL '30 days'
        AND "companyId" = ${req.user.companyId}
      GROUP BY day ORDER BY day`;
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
