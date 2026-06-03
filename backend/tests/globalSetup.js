// One-time setup for the whole Jest run.
// Forces a test-mode env and applies the Prisma schema to a clean DB.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://fieldforce:fieldforce@localhost:5432/fieldforce';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15';
process.env.LOG_LEVEL = 'error';

const { execSync } = require('child_process');

module.exports = async () => {
  // `prisma db push` syncs the schema.prisma to the database WITHOUT requiring
  // committed migration files. That keeps CI fast and lets the test suite run
  // before the first `prisma migrate dev` has produced a migrations directory.
  //
  // Production deploys still use `prisma migrate deploy` against committed
  // migrations — see RUNNING.md section 6.
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
  } catch (e) {
    console.error('Failed to apply Prisma schema to test DB:', e.message);
    throw e;
  }
};
