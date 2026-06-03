const prisma = require('../utils/prisma');
const webhookService = require('../services/webhookService');

/**
 * Form schema shape (stored in FormTemplate.schema):
 *   [
 *     { id: "owner_present", label: "Owner present?", type: "boolean", required: true },
 *     { id: "property_age",  label: "Age (years)",    type: "number",  required: true, min: 0 },
 *     { id: "condition",     label: "Overall condition", type: "select",
 *       options: ["Excellent","Good","Average","Poor"] },
 *     { id: "photos",        label: "Site photos",   type: "photos", min: 2, max: 6 },
 *     { id: "remarks",       label: "Remarks",       type: "text", multiline: true },
 *     { id: "signature",     label: "Owner signature", type: "signature" }
 *   ]
 */
const ALLOWED_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'photos', 'signature'];

function validateSchema(schema) {
  if (!Array.isArray(schema)) throw new Error('schema must be an array of field definitions');
  for (const f of schema) {
    if (!f.id || !f.label || !f.type) throw new Error('every field needs id, label, type');
    if (!ALLOWED_TYPES.includes(f.type)) throw new Error(`unknown field type: ${f.type}`);
  }
}

exports.listTemplates = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.query.activeOnly !== 'false') where.isActive = true;
    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
    res.json(templates);
  } catch (e) { next(e); }
};

exports.getTemplate = async (req, res, next) => {
  try {
    const t = await prisma.formTemplate.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) { next(e); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const { key, name, description, schema } = req.body;
    if (!key || !name) return res.status(400).json({ error: 'key and name required' });
    validateSchema(schema);

    // New template = new version of existing key, or v1 if first
    const existing = await prisma.formTemplate.findFirst({
      where: { companyId: req.user.companyId, key },
      orderBy: { version: 'desc' },
    });
    const version = existing ? existing.version + 1 : 1;

    const t = await prisma.formTemplate.create({
      data: { companyId: req.user.companyId, key, name, description, schema, version },
    });
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
};

exports.deactivate = async (req, res, next) => {
  try {
    const t = await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(t);
  } catch (e) { next(e); }
};

exports.submit = async (req, res, next) => {
  try {
    const { templateId, data, attachments, refId, refType, lat, lng } = req.body;
    if (!templateId || !data) return res.status(400).json({ error: 'templateId and data required' });

    const template = await prisma.formTemplate.findFirst({
      where: { id: templateId, companyId: req.user.companyId },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Validate required fields are present
    for (const field of template.schema) {
      if (field.required && (data[field.id] == null || data[field.id] === '')) {
        return res.status(400).json({ error: `Missing required field: ${field.label}` });
      }
    }

    const sub = await prisma.formSubmission.create({
      data: {
        companyId: req.user.companyId,
        templateId,
        userId: req.user.sub,
        refId, refType,
        data, attachments,
        lat, lng,
      },
    });

    // Fire webhook so partners (ERP, claims systems, etc.) can react
    webhookService.emit(req.user.companyId, 'form.submitted', {
      submissionId: sub.id,
      templateKey: template.key,
      templateName: template.name,
      userId: req.user.sub,
      refId, refType,
      capturedAt: sub.capturedAt,
    }).catch(() => {});

    res.status(201).json(sub);
  } catch (e) { next(e); }
};

exports.listSubmissions = async (req, res, next) => {
  try {
    const where = { companyId: req.user.companyId };
    if (req.query.templateId) where.templateId = req.query.templateId;
    if (req.query.refId) where.refId = req.query.refId;
    if (req.user.role === 'EMPLOYEE') where.userId = req.user.sub;

    const subs = await prisma.formSubmission.findMany({
      where,
      include: { template: { select: { name: true, key: true, version: true } } },
      orderBy: { capturedAt: 'desc' },
      take: 200,
    });
    res.json(subs);
  } catch (e) { next(e); }
};

exports.getSubmission = async (req, res, next) => {
  try {
    const sub = await prisma.formSubmission.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: { template: true },
    });
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json(sub);
  } catch (e) { next(e); }
};
