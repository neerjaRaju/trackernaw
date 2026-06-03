/**
 * DPDP data-subject endpoints — every employee can:
 *   - read/update/withdraw their own consents
 *   - export everything we hold about them
 *   - request erasure (anonymizes the user immediately and schedules raw-data purge)
 *
 * All actions are written to AuditLog with the requester's IP + user-agent for
 * compliance evidence (RBI vendor guidance).
 */
const prisma = require('../utils/prisma');

async function audit(req, action, meta) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        action,
        entityType: 'User',
        entityId: req.user.sub,
        meta,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  } catch (_) { /* never fail the API call because of audit */ }
}

// --- Consent management ---

exports.consentLog = async (req, res, next) => {
  try {
    const rows = await prisma.consent.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (e) { next(e); }
};

exports.recordConsent = async (req, res, next) => {
  try {
    const { type, granted, purpose, policyVersion } = req.body;
    if (!type || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'type and granted required' });
    }
    const row = await prisma.consent.create({
      data: {
        userId: req.user.sub,
        type, granted, purpose, policyVersion,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
    await audit(req, granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN', { type, policyVersion });
    res.status(201).json(row);
  } catch (e) { next(e); }
};

// --- Personal-data export (DPDP Section 11 right of access) ---
// Returns a single JSON download with every entity tied to the requesting user.

exports.exportData = async (req, res, next) => {
  try {
    const id = req.user.sub;
    const [user, attendances, locations, tasksAssigned, tasksCreated, expenses, orders, visits, notifications, messages, consents] = await Promise.all([
      prisma.user.findUnique({ where: { id }, include: { company: { select: { name: true, subdomain: true } } } }),
      prisma.attendance.findMany({ where: { userId: id } }),
      prisma.locationPing.findMany({ where: { userId: id } }),
      prisma.task.findMany({ where: { assigneeId: id } }),
      prisma.task.findMany({ where: { createdById: id } }),
      prisma.expense.findMany({ where: { userId: id } }),
      prisma.order.findMany({ where: { userId: id } }),
      prisma.visit.findMany({ where: { userId: id } }),
      prisma.notification.findMany({ where: { userId: id } }),
      prisma.message.findMany({ where: { OR: [{ senderId: id }, { recipientId: id }] } }),
      prisma.consent.findMany({ where: { userId: id } }),
    ]);

    if (user) { delete user.passwordHash; delete user.faceEmbedding; }
    const bundle = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      user,
      attendances,
      locations,
      tasksAssigned,
      tasksCreated,
      expenses,
      orders,
      visits,
      notifications,
      messages,
      consents,
    };
    await audit(req, 'DATA_EXPORTED', { rows: {
      attendances: attendances.length,
      locations: locations.length,
      messages: messages.length,
    }});

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${id}.json"`);
    res.send(JSON.stringify(bundle, null, 2));
  } catch (e) { next(e); }
};

// --- Erasure (DPDP Section 12 right to correction and erasure) ---
// Strategy: immediate anonymization (preserves rows for legal retention) +
// scheduled hard-delete after the company's retention window expires.

exports.requestErasure = async (req, res, next) => {
  try {
    const id = req.user.sub;
    const reason = req.body?.reason || null;

    // BFSI retention default: 13 months for aggregated, 90 days for raw — match BRD.
    const scheduledFor = new Date(Date.now() + 90 * 24 * 3600_000);

    const erasure = await prisma.erasureRequest.create({
      data: { userId: id, reason, scheduledFor, status: 'PROCESSING' },
    });

    // Immediate anonymization: scrub PII, revoke sessions, drop biometric.
    const anon = `erased-${id.slice(0, 8)}@anon.invalid`;
    await prisma.user.update({
      where: { id },
      data: {
        email: anon,
        phone: null,
        fullName: 'Erased user',
        avatarUrl: null,
        faceEmbedding: null,
        deviceId: null,
        fcmToken: null,
        isActive: false,
        passwordHash: 'erased',
      },
    });
    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });

    // Delete raw location pings immediately (granular biometric/movement data)
    await prisma.locationPing.deleteMany({ where: { userId: id } });

    await audit(req, 'ERASURE_REQUESTED', { erasureId: erasure.id, scheduledFor });
    res.json({
      ok: true,
      erasureId: erasure.id,
      scheduledFor,
      message: 'Personal identifiers anonymized immediately. Aggregated records will be purged after 90 days.',
    });
  } catch (e) { next(e); }
};
