const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const lockout = require('../services/lockoutService');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

const PASSWORD_MIN = 8;
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain a letter and a digit';
  return null;
}

function issueTokens(user) {
  const payload = { sub: user.id, role: user.role };
  if (user.role !== 'SUPER_ADMIN') {
    payload.companyId = user.companyId;
  }
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
  };
}

exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, companyName, phone } = req.body;
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'email, password, companyName required' });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const subdomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const company = await prisma.company.create({
      data: { name: companyName, subdomain: `${subdomain}-${Date.now().toString(36)}` },
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        fullName: fullName || email.split('@')[0],
        passwordHash,
        role: 'COMPANY_ADMIN',
        companyId: company.id,
      },
    });

    const tokens = issueTokens(user);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(tokens.refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
    res.status(201).json({ user: stripUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    if (await lockout.isLocked(email)) {
      return res.status(429).json({
        error: 'Too many failed attempts. Account temporarily locked. Try again in 15 minutes.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const r = await lockout.recordFailure(email);
      if (user) {
        await prisma.auditLog.create({ data: {
          companyId: user.companyId, userId: user.id, action: 'LOGIN_FAILED',
          entityType: 'User', entityId: user.id,
          ip: req.ip, userAgent: req.headers['user-agent'],
          meta: { attempt: r.attempts, locked: r.locked },
        }}).catch(() => {});
      }
      return res.status(401).json({
        error: 'Invalid credentials',
        ...(r.locked ? { code: 'ACCOUNT_LOCKED' } : { remainingAttempts: r.remaining }),
      });
    }
    if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

    await lockout.clear(email);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({ data: {
      companyId: user.companyId, userId: user.id, action: 'LOGIN_SUCCESS',
      entityType: 'User', entityId: user.id,
      ip: req.ip, userAgent: req.headers['user-agent'],
    }}).catch(() => {});

    const tokens = issueTokens(user);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(tokens.refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
    res.json({ user: stripUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    const decoded = verifyRefresh(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const payload = { sub: user.id, role: user.role };
    if (user.role !== 'SUPER_ADMIN') {
      payload.companyId = user.companyId;
    }
    res.json({ accessToken: signAccess(payload) });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.requestOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.set(`otp:${phone}`, otp, 'EX', 300);
  // TODO: send via Twilio in production
  res.json({ ok: true, devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined });
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const stored = await redis.get(`otp:${phone}`);
    if (!stored || stored !== otp) return res.status(401).json({ error: 'Invalid OTP' });
    await redis.del(`otp:${phone}`);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: stripUser(user), ...issueTokens(user) });
  } catch (err) {
    next(err);
  }
};

function stripUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, faceEmbedding, ...safe } = u;
  return safe;
}
