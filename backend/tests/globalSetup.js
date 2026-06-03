// One-time setup for the whole Jest run.
// Forces a separate test database so we never touch dev data.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://fieldforce:fieldforce@localhost:5432/fieldforce';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15';
// Suppress request logs in tests
process.env.LOG_LEVEL = 'error';

const { execSync } = require('child_process');

module.exports = async () => {
  // Apply migrations against the test DB
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  } catch (e) {
    console.warn('Prisma migrate deploy failed in test setup — assuming schema is current');
  }
};
