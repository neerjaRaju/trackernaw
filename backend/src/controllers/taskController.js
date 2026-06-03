const prisma = require('../utils/prisma');
const { emitToUser } = require('../sockets');

exports.list = async (req, res, next) => {
  try {
    const { status, assigneeId } = req.query;
    const where = { companyId: req.user.companyId };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (req.user.role === 'EMPLOYEE') where.assigneeId = req.user.sub;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      include: { assignee: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.json(tasks);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, priority, dueAt, assigneeId } = req.body;
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        dueAt: dueAt ? new Date(dueAt) : null,
        assigneeId,
        createdById: req.user.sub,
        companyId: req.user.companyId,
      },
    });
    if (assigneeId) emitToUser(assigneeId, 'task:new', task);
    res.status(201).json(task);
  } catch (e) { next(e); }
};

exports.detail = async (req, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: { assignee: true, comments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(task);
  } catch (e) { next(e); }
};

exports.complete = async (req, res, next) => {
  try {
    const { proofUrl, lat, lng } = req.body;
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        proofUrl,
        completedLat: lat,
        completedLng: lng,
      },
    });
    res.json(task);
  } catch (e) { next(e); }
};

exports.comment = async (req, res, next) => {
  try {
    const c = await prisma.taskComment.create({
      data: {
        taskId: req.params.id,
        userId: req.user.sub,
        body: req.body.body,
      },
    });
    res.status(201).json(c);
  } catch (e) { next(e); }
};
