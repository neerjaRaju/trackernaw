const prisma = require('../utils/prisma');
const { haversineMeters } = require('../services/geofenceService');
const ocrService = require('../services/ocrService');

exports.list = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.sub;
    if (req.query.status) where.status = req.query.status;
    const items = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true } } },
    });
    res.json(items);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { category, amount, currency, description, receiptUrl, fromLat, fromLng, toLat, toLng } = req.body;
    let distanceKm = null;
    if (fromLat && fromLng && toLat && toLng) {
      distanceKm = haversineMeters(fromLat, fromLng, toLat, toLng) / 1000;
    }
    const expense = await prisma.expense.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.sub,
        category,
        amount,
        currency: currency || 'INR',
        description,
        receiptUrl,
        fromLat, fromLng, toLat, toLng,
        distanceKm,
        status: 'SUBMITTED',
      },
    });
    res.status(201).json(expense);
  } catch (e) { next(e); }
};

// Run OCR over a just-uploaded receipt (S3 key).
// Body: { key }  →  returns { vendor, total, currency, date }
exports.ocr = async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key required (S3 object key from /uploads/presign)' });
    if (!String(key).startsWith(`${req.user.companyId}/`)) {
      return res.status(403).json({ error: 'Cross-tenant access forbidden' });
    }
    const result = await ocrService.analyzeReceipt(key);
    if (!result) {
      return res.status(202).json({ ok: false, reason: 'OCR not configured or no fields detected' });
    }
    res.json(result);
  } catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedById: req.user.sub, approvedAt: new Date() },
    });
    res.json(expense);
  } catch (e) { next(e); }
};

exports.reject = async (req, res, next) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', rejectedReason: req.body.reason },
    });
    res.json(expense);
  } catch (e) { next(e); }
};
