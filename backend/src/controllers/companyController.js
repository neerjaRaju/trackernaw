const prisma = require('../utils/prisma');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          subdomain: true,
          logoUrl: true,
          plan: true,
          isActive: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.company.count(),
    ]);

    res.json({
      data: companies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'COMPANY_ADMIN' },
          select: { id: true, email: true, fullName: true, role: true, isActive: true },
        },
        _count: { select: { users: true, teams: true } },
      },
    });

    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, subdomain, plan } = req.body;
    if (!name || !subdomain) {
      return res.status(400).json({ error: 'name and subdomain required' });
    }

    const existing = await prisma.company.findUnique({ where: { subdomain } });
    if (existing) return res.status(409).json({ error: 'Subdomain already in use' });

    const company = await prisma.company.create({
      data: {
        name,
        subdomain,
        plan: plan || 'free',
        isActive: true,
      },
    });

    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, plan, isActive } = req.body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(plan && { plan }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(company);
  } catch (err) {
    next(err);
  }
};

exports.promoteAdmin = async (req, res, next) => {
  try {
    const { id: companyId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.companyId !== companyId) {
      return res.status(400).json({ error: 'User does not belong to this company' });
    }

    if (user.role === 'COMPANY_ADMIN') {
      return res.status(400).json({ error: 'User is already a company admin' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: 'COMPANY_ADMIN' },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user.sub,
        action: 'PROMOTE_ADMIN',
        entityType: 'User',
        entityId: userId,
        meta: { previousRole: user.role, newRole: 'COMPANY_ADMIN' },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.demoteAdmin = async (req, res, next) => {
  try {
    const { id: companyId } = req.params;
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
      return res.status(400).json({ error: 'userId and newRole required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.companyId !== companyId) {
      return res.status(400).json({ error: 'User does not belong to this company' });
    }

    if (user.role !== 'COMPANY_ADMIN') {
      return res.status(400).json({ error: 'User is not a company admin' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user.sub,
        action: 'DEMOTE_ADMIN',
        entityType: 'User',
        entityId: userId,
        meta: { previousRole: 'COMPANY_ADMIN', newRole },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
};
