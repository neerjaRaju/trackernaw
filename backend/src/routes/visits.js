const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');
const prisma = require('../utils/prisma');

router.use(authenticate, requireTenant);

router.get('/', async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.sub;
    const visits = await prisma.visit.findMany({
      where,
      include: { dealer: true, user: { select: { id: true, fullName: true } } },
      orderBy: { checkInAt: 'desc' },
      take: 200,
    });
    res.json(visits);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { dealerId, lat, lng, notes, photoUrl } = req.body;
    // companyId always from JWT — never from request body.
    const visit = await prisma.visit.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        dealerId,
        lat, lng, notes, photoUrl,
        checkInAt: new Date(),
      },
    });
    res.status(201).json(visit);
  } catch (e) { next(e); }
});

router.post('/:id/checkout', async (req, res, next) => {
  try {
    // Scope the lookup so cross-tenant IDs return 404 — no enumeration via 403.
    const visit = await prisma.visit.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!visit) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.visit.update({
      where: { id: visit.id },
      data: { checkOutAt: new Date() },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

module.exports = router;
