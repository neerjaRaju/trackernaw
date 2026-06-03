module.exports = {
  testEnvironment: 'node',
  // Cleanup happens once at the end of the whole test run via globalTeardown —
  // simpler and faster than per-file teardown (runInBand means we don't risk
  // tests interleaving anyway).
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 15000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/worker.js',
  ],
  coverageThreshold: {
    global: { lines: 60, functions: 60, branches: 40, statements: 60 },
  },
};
