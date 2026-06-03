const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');

router.use(authenticate, requireTenant, authorize('COMPANY_ADMIN', 'SUPER_ADMIN'));

const SUPPORTED_EVENTS = [
  'attendance.checked_in',
  'attendance.checked_out',
  'visit.completed',
  'task.completed',
  'expense.submitted',
  'expense.approved',
  'sos.triggered',
  'sos.resolved',
  'form.submitted',
  'order.created',
  'leave.requested',
  'leave.decided',
];

router.get('/events', (_req, res) => res.json(SUPPORTED_EVENTS));

router.get('/', async (req, res, next) => {
  try {
    const hooks = await prisma.webhook.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { createdAt: 'desc' },
    });
    // Mask secret in list view — only show prefix
    res.json(hooks.map((h) => ({ ...h, secret: h.secret.slice(0, 6) + '…' })));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, url, events } = req.body;
    if (!name || !url || !Array.isArray(events) || !events.length) {
      return res.status(400).json({ error: 'name, url, events required' });
    }
    const invalid = events.filter((e) => !SUPPORTED_EVENTS.includes(e));
    if (invalid.length) return res.status(400).json({ error: `Unsupported events: ${invalid.join(',')}` });

    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    // companyId always from JWT — never from request body.
    const hook = await prisma.webhook.create({
      data: { companyId: req.user.companyId, name, url, events, secret },
    });
    // Return secret in full ONCE on creation, then mask in subsequent reads
    res.status(201).json(hook);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, url, events, isActive } = req.body;
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!hook) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.webhook.update({
      where: { id: hook.id },
      data: { name, url, events, isActive },
    });
    res.json({ ...updated, secret: updated.secret.slice(0, 6) + '…' });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!hook) return res.status(404).json({ error: 'Not found' });
    await prisma.webhook.delete({ where: { id: hook.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:id/deliveries', async (req, res, next) => {
  try {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!hook) return res.status(404).json({ error: 'Not found' });
    const items = await prisma.webhookDelivery.findMany({
      where: { webhookId: hook.id },
      orderBy: { attemptedAt: 'desc' },
      take: 100,
    });
    res.json(items);
  } catch (e) { next(e); }
});

module.exports = router;
