const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');

router.use(authenticate, requireTenant);

// All authenticated users can see fences in their own company.
router.get('/', async (req, res, next) => {
  try {
    const fences = await prisma.geofence.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(fences);
  } catch (e) { next(e); }
});

// Admins/managers create.
// IMPORTANT: companyId always comes from the verified JWT, never the request body.
// Accepting body.companyId would allow cross-tenant writes.
router.post('/', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, lat, lng, radiusM, type } = req.body;
    if (!name || lat == null || lng == null || !radiusM) {
      return res.status(400).json({ error: 'name, lat, lng, radiusM required' });
    }
    const fence = await prisma.geofence.create({
      data: {
        companyId: req.user.companyId,
        name,
        lat: Number(lat),
        lng: Number(lng),
        radiusM: Number(radiusM),
        type: type || 'office',
      },
    });
    res.status(201).json(fence);
  } catch (e) { next(e); }
});

router.put('/:id', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Scope the lookup by companyId so cross-tenant IDs return 404, not 403 — avoids enumeration.
    const fence = await prisma.geofence.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!fence) return res.status(404).json({ error: 'Not found' });
    // Never let the body override companyId on update either.
    const { companyId, ...safe } = req.body || {};
    const updated = await prisma.geofence.update({ where: { id: fence.id }, data: safe });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', authorize('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const fence = await prisma.geofence.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!fence) return res.status(404).json({ error: 'Not found' });
    await prisma.geofence.delete({ where: { id: fence.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
