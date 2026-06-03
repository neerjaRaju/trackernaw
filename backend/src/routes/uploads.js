const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireTenant = require('../middleware/requireTenant');
const { presignUpload, presignDownload, KIND_PREFIXES } = require('../services/uploadService');

router.use(authenticate, requireTenant);

// Generate a presigned PUT URL. Client uploads directly to S3.
// companyId always from JWT — never from request body, or a user could write
// into another tenant's S3 prefix.
router.post('/presign', async (req, res, next) => {
  try {
    const { kind, contentType, filename } = req.body;
    if (!kind || !KIND_PREFIXES[kind]) {
      return res.status(400).json({ error: `kind must be one of: ${Object.keys(KIND_PREFIXES).join(', ')}` });
    }
    const result = await presignUpload({
      companyId: req.user.companyId,
      userId: req.user.sub,
      kind,
      contentType: contentType || 'application/octet-stream',
      filename,
    });
    res.json(result);
  } catch (e) { next(e); }
});

// Generate a presigned GET URL for a private object (manager viewing a receipt etc.).
// Key MUST be prefixed with the caller's companyId — otherwise it belongs to a
// different tenant and we refuse, never silently allow.
router.get('/download', async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'key required' });
    if (!String(key).startsWith(`${req.user.companyId}/`)) {
      return res.status(403).json({ error: 'Cross-tenant access forbidden' });
    }
    const url = await presignDownload(String(key));
    res.json({ url });
  } catch (e) { next(e); }
});

// --- Dev stub upload sink (only used when AWS is not configured) ---
const DEV_DIR = path.join(__dirname, '..', '..', '..', 'uploads-dev');
if (!fs.existsSync(DEV_DIR)) try { fs.mkdirSync(DEV_DIR, { recursive: true }); } catch {}

router.put('/dev/:encodedKey', express.raw({ type: '*/*', limit: '20mb' }), (req, res) => {
  const key = decodeURIComponent(req.params.encodedKey);
  const dest = path.join(DEV_DIR, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, req.body);
  res.json({ ok: true, key });
});

module.exports = router;
