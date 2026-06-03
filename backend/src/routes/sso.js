const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { generators } = (() => {
  try { return require('openid-client'); } catch { return { generators: null }; }
})();
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const { signAccess, signRefresh } = require('../utils/jwt');
const sso = require('../services/ssoService');
const logger = require('../utils/logger');

// Public: which SSO providers are wired up?
router.get('/providers', (_req, res) => {
  res.json({ providers: sso.listConfigured() });
});

// Kick off SSO — redirect the browser to the IdP authorization URL.
// Query: ?companyId=<existing-company-id-or-subdomain>
router.get('/:provider', async (req, res, next) => {
  try {
    if (!generators) {
      return res.status(501).json({ error: 'openid-client not installed. Run: npm install openid-client' });
    }
    const { provider } = req.params;
    if (!sso.isConfigured(provider)) {
      return res.status(404).json({ error: `Provider "${provider}" is not configured` });
    }
    const { client, scope } = await sso.getClient(provider);
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = generators.nonce();
    // Hold the company hint + flow state in Redis with 10-minute TTL
    await redis.set(
      `sso:${state}`,
      JSON.stringify({ provider, companyHint: req.query.companyId || null, nonce }),
      'EX', 600
    );
    const url = client.authorizationUrl({ scope, state, nonce });
    res.redirect(url);
  } catch (e) { next(e); }
});

// Callback from the IdP — exchange code, find/create user, issue tokens, redirect to admin.
router.get('/:provider/callback', async (req, res, next) => {
  try {
    if (!generators) return res.status(501).send('openid-client not installed');

    const { provider } = req.params;
    const { state } = req.query;
    const saved = await redis.get(`sso:${state}`);
    if (!saved) return res.status(400).send('Invalid or expired SSO state');
    await redis.del(`sso:${state}`);
    const { companyHint, nonce } = JSON.parse(saved);

    const { client } = await sso.getClient(provider);
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(
      `${process.env.SSO_REDIRECT_BASE || 'http://localhost:4000'}/api/v1/auth/sso/${provider}/callback`,
      params,
      { state, nonce }
    );
    const claims = tokenSet.claims();
    const email = claims.email || claims.preferred_username;
    const fullName = claims.name || email;
    if (!email) return res.status(400).send('IdP did not return an email');

    // Resolve company: prefer hint, else email domain match, else create one
    let company = null;
    if (companyHint) {
      company = await prisma.company.findFirst({
        where: { OR: [{ id: companyHint }, { subdomain: companyHint }] },
      });
    }
    if (!company) {
      const domain = email.split('@')[1];
      company = await prisma.company.findFirst({ where: { subdomain: { startsWith: domain.split('.')[0] } } });
    }
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: claims.tenant_name || email.split('@')[1] || 'New tenant',
          subdomain: `${email.split('@')[1].replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
          plan: 'pro',
        },
      });
    }

    // Find or create user inside that company
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
          role: 'EMPLOYEE',
          companyId: company.id,
        },
      });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'SSO_LOGIN',
        entityType: 'User',
        entityId: user.id,
        meta: { provider },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});

    const payload = { sub: user.id, companyId: user.companyId, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });

    // Hand off to the admin panel via fragment so tokens never hit server logs.
    const target = process.env.ADMIN_PANEL_URL || 'http://localhost:5173';
    res.redirect(`${target}/login#access=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}&provider=${provider}`);
  } catch (e) {
    logger.error('SSO callback failed', e);
    next(e);
  }
});

module.exports = router;
