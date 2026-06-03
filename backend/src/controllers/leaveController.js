const prisma = require('../utils/prisma');
const { pushToUser } = require('../services/notificationService');
const { emitToUser, emitToCompany } = require('../sockets');

function diffDays(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (24 * 3600_000)) + 1);
}

exports.list = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.sub;
    if (req.query.status) where.status = req.query.status;
    const rows = await prisma.leaveRequest.findMany({
      where,
      include: { /* fetch user names via a separate query for portability */ },
      orderBy: { createdAt: 'desc' },
    });
    // Hydrate user info
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, avatarUrl: true },
        })
      : [];
    const map = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json(rows.map((r) => ({ ...r, user: map[r.userId] || null })));
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { type, startDate, endDate, reason, halfDay } = req.body;
    if (!type || !startDate || !endDate) {
      return res.status(400).json({ error: 'type, startDate, endDate required' });
    }
    const days = halfDay ? 0.5 : diffDays(startDate, endDate);
    const lr = await prisma.leaveRequest.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        type, days, reason,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    // Notify the user's manager
    const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { managerId: true, fullName: true } });
    if (me?.managerId) {
      await pushToUser(me.managerId, {
        title: 'Leave request',
        body: `${me.fullName} requested ${days} day(s) of ${type} leave`,
        type: 'leave',
        data: { leaveId: lr.id },
      }).catch(() => {});
      emitToUser(me.managerId, 'leave:new', lr);
    }
    res.status(201).json(lr);
  } catch (e) { next(e); }
};

exports.decide = async (req, res, next) => {
  try {
    const { status, decisionNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }
    const lr = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status, decisionNote, approverId: req.user.sub, decidedAt: new Date() },
    });

    // If approved, backfill attendance rows for the leave period
    if (status === 'APPROVED') {
      const dates = [];
      const cur = new Date(lr.startDate);
      while (cur <= lr.endDate) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      await Promise.all(dates.map((d) => prisma.attendance.upsert({
        where: { userId_date: { userId: lr.userId, date: d } },
        update: { status: 'ON_LEAVE' },
        create: { userId: lr.userId, companyId: lr.companyId, date: d, status: 'ON_LEAVE' },
      })));
    }

    emitToUser(lr.userId, 'leave:update', lr);
    await pushToUser(lr.userId, {
      title: `Leave ${status.toLowerCase()}`,
      body: decisionNote || `Your ${lr.type} leave for ${lr.days} day(s) was ${status.toLowerCase()}.`,
      type: 'leave',
      data: { leaveId: lr.id },
    }).catch(() => {});
    res.json(lr);
  } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try {
    const lr = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json(lr);
  } catch (e) { next(e); }
};

exports.balance = async (req, res, next) => {
  try {
    // Simple year-to-date used vs annual allowance (configurable per company in real impl)
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const taken = await prisma.leaveRequest.groupBy({
      by: ['type'],
      where: { userId: req.user.sub, status: 'APPROVED', startDate: { gte: yearStart } },
      _sum: { days: true },
    });
    const used = Object.fromEntries(taken.map((t) => [t.type, t._sum.days || 0]));
    const allowance = { CASUAL: 12, SICK: 7, EARNED: 18, UNPAID: 999, COMP_OFF: 999 };
    res.json(Object.entries(allowance).map(([type, total]) => ({
      type,
      taken: used[type] || 0,
      remaining: Math.max(0, total - (used[type] || 0)),
      allowance: total,
    })));
  } catch (e) { next(e); }
};
