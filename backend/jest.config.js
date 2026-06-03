module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEach: ['<rootDir>/tests/teardown.js'],
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
