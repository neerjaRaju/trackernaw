const prisma = require('../utils/prisma');
const { emitToCompany } = require('../sockets');
const { pushToUser } = require('../services/notificationService');
const webhookService = require('../services/webhookService');

// Trigger an SOS alert. Body: { lat, lng, accuracy?, audioUrl?, note? }
exports.trigger = async (req, res, next) => {
  try {
    const { lat, lng, accuracy, audioUrl, note } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const alert = await prisma.sosAlert.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        lat, lng, accuracy,
        audioUrl, note,
      },
    });

    // Hydrate sender info for the broadcast
    const sender = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, fullName: true, phone: true, avatarUrl: true },
    });

    // Broadcast to the whole company in real time — every dashboard lights up
    emitToCompany(req.user.companyId, 'sos:new', { ...alert, user: sender });

    // FCM push to all managers in the company (and admin roles)
    const managers = await prisma.user.findMany({
      where: {
        companyId: req.user.companyId,
        role: { in: ['MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'] },
        isActive: true,
      },
      select: { id: true },
    });
    await Promise.all(managers.map((m) => pushToUser(m.id, {
      title: '🚨 SOS from ' + (sender?.fullName || 'a field agent'),
      body: note || `Tap to open the live map and respond. Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      type: 'sos',
      data: { sosId: alert.id, lat: String(lat), lng: String(lng) },
    }).catch(() => {})));

    // Fire webhook to integrated systems (security ops, on-call paging, etc.)
    webhookService.emit(req.user.companyId, 'sos.triggered', {
      alertId: alert.id,
      userId: req.user.sub,
      userName: sender?.fullName,
      lat, lng, note,
      triggeredAt: alert.createdAt,
    }).catch(() => {});

    res.status(201).json(alert);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.query.status) where.status = req.query.status;
    const alerts = await prisma.sosAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Attach user names
    const userIds = [...new Set(alerts.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, phone: true, avatarUrl: true },
    });
    const map = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json(alerts.map((a) => ({ ...a, user: map[a.userId] || null })));
  } catch (e) { next(e); }
};

exports.acknowledge = async (req, res, next) => {
  try {
    const alert = await prisma.sosAlert.update({
      where: { id: req.params.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedById: req.user.sub, acknowledgedAt: new Date() },
    });
    emitToCompany(req.user.companyId, 'sos:update', alert);
    res.json(alert);
  } catch (e) { next(e); }
};

exports.resolve = async (req, res, next) => {
  try {
    const alert = await prisma.sosAlert.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedById: req.user.sub, resolvedAt: new Date() },
    });
    emitToCompany(req.user.companyId, 'sos:update', alert);
    webhookService.emit(req.user.companyId, 'sos.resolved', {
      alertId: alert.id,
      resolvedById: req.user.sub,
      resolvedAt: alert.resolvedAt,
    }).catch(() => {});
    res.json(alert);
  } catch (e) { next(e); }
};
