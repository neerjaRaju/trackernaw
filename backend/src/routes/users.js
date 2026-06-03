const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const { authenticate, authorize } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');

router.use(authenticate, requireTenant);

// Same-org teammates with last-known location for the team map.
router.get('/teammates', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        companyId: req.user.companyId,
        isActive: true,
        NOT: { id: req.user.sub },
      },
      select: { id: true, fullName: true, avatarUrl: true, role: true },
    });
    const result = await Promise.all(users.map(async (u) => {
      const cached = await redis.get(`loc:${u.id}`);
      if (!cached) return { ...u, location: null };
      try {
        const loc = JSON.parse(cached);
        return { ...u, location: { lat: loc.lat, lng: loc.lng, recordedAt: loc.recordedAt, isMoving: loc.isMoving } };
      } catch { return { ...u, location: null }; }
    }));
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user.sub, companyId: req.user.companyId },
      include: { company: true, team: true },
    });
    if (user) delete user.passwordHash;
    res.json(user);
  } catch (e) { next(e); }
});

router.get('/', authorize('MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { ...(req.user.companyId && { companyId: req.user.companyId }) },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, lastLoginAt: true, avatarUrl: true, team: true },
    });
    res.json(users);
  } catch (e) { next(e); }
});

router.post('/', authorize('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { email, password, fullName, phone, role, teamId } = req.body;
    const passwordHash = await bcrypt.hash(password || 'changeme', 10);
    // companyId always from JWT — never from request body.
    const user = await prisma.user.create({
      data: { email, phone, fullName, role, teamId, passwordHash, companyId: req.user.companyId },
    });
    delete user.passwordHash;
    res.status(201).json(user);
  } catch (e) { next(e); }
});

router.put('/:id', authorize('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Scope by tenant + strip companyId/role from request body to prevent privilege/tenant injection.
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!target) return res.status(404).json({ error: 'Not found' });
    const { companyId, passwordHash, ...safe } = req.body || {};
    const user = await prisma.user.update({ where: { id: target.id }, data: safe });
    delete user.passwordHash;
    res.json(user);
  } catch (e) { next(e); }
});

// Face enrollment — store reference selfie URL on the caller's own user record.
router.post('/face/enroll', async (req, res, next) => {
  try {
    const { referenceUrl } = req.body;
    if (!referenceUrl) return res.status(400).json({ error: 'referenceUrl required' });
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { avatarUrl: referenceUrl },
    });
    res.json({ ok: true, enrolled: true });
  } catch (e) { next(e); }
});

router.post('/fcm-token', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { fcmToken: req.body.token, deviceId: req.body.deviceId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
