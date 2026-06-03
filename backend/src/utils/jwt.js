const jwt = require('jsonwebtoken');

// Production refuses to start with default or short secrets — silent bypass would be catastrophic.
const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const WEAK = new Set(['change-me', 'change-me-too', 'change-me-in-production', 'secret', '']);

if (process.env.NODE_ENV === 'production') {
  if (!ACCESS_SECRET || ACCESS_SECRET.length < 32 || WEAK.has(ACCESS_SECRET)) {
    throw new Error('JWT_SECRET must be a 32+ char random string in production');
  }
  if (!REFRESH_SECRET || REFRESH_SECRET.length < 32 || WEAK.has(REFRESH_SECRET)) {
    throw new Error('JWT_REFRESH_SECRET must be a 32+ char random string in production');
  }
  if (ACCESS_SECRET === REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must differ in production');
  }
}

const _AS = ACCESS_SECRET || 'dev-only-do-not-use-in-prod';
const _RS = REFRESH_SECRET || 'dev-only-refresh-do-not-use';

function signAccess(payload) {
  return jwt.sign(payload, _AS, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
}
function signRefresh(payload) {
  return jwt.sign(payload, _RS, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
}
function verifyAccess(token)  { return jwt.verify(token, _AS); }
function verifyRefresh(token) { return jwt.verify(token, _RS); }

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
