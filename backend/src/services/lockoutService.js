/**
 * Account lockout — 5 failed login attempts in 15 minutes locks the account for 15 minutes.
 * Counters live in Redis with TTLs, keyed by lower-cased email to defeat case-folding bypass.
 */
const redis = require('../utils/redis');

const MAX_ATTEMPTS = Number(process.env.LOCKOUT_MAX_ATTEMPTS || 5);
const WINDOW_SECONDS = Number(process.env.LOCKOUT_WINDOW_SECONDS || 900);   // 15 min
const LOCK_SECONDS = Number(process.env.LOCKOUT_DURATION_SECONDS || 900);   // 15 min

const failKey  = (email) => `auth:fails:${email.toLowerCase()}`;
const lockKey  = (email) => `auth:lock:${email.toLowerCase()}`;

async function isLocked(email) {
  return !!(await redis.get(lockKey(email)));
}

async function recordFailure(email) {
  const key = failKey(email);
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, WINDOW_SECONDS);
  if (n >= MAX_ATTEMPTS) {
    await redis.set(lockKey(email), '1', 'EX', LOCK_SECONDS);
    await redis.del(key);
    return { locked: true, attempts: n };
  }
  return { locked: false, attempts: n, remaining: MAX_ATTEMPTS - n };
}

async function clear(email) {
  await redis.del(failKey(email));
  await redis.del(lockKey(email));
}

module.exports = { isLocked, recordFailure, clear, MAX_ATTEMPTS };
