module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 15000,
  // Force-exit covers the case where an external resource (Redis socket, Prisma
  // pool, in-flight DNS resolution from the rate-limit middleware) leaves a
  // handle open. The globalTeardown explicitly disconnects everything we own,
  // so this is belt-and-suspenders, not papering over a real leak.
  forceExit: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/worker.js',
    '!src/jobs/**',           // jobs are integration-tested separately
  ],
  // Realistic baseline — matches current coverage with a 5% buffer.
  // Ratchet these up as more tests get written. Aspirational target is 60%.
  coverageThreshold: {
    global: { lines: 30, functions: 15, branches: 10, statements: 30 },
  },
};
