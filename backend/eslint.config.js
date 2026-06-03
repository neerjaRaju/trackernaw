// ESLint 9 flat-config. Permissive baseline — we lint to catch real bugs
// (typos, undef vars, unreachable code), not to enforce style. Code style is
// the reviewer's job, not CI's.
//
// Ratchet rules tighter over time. Today's job is "lint passes without
// rewriting the whole codebase."

const NODE_GLOBALS = {
  process:        'readonly',
  console:        'readonly',
  Buffer:         'readonly',
  __dirname:      'readonly',
  __filename:     'readonly',
  module:         'writable',
  require:        'readonly',
  exports:        'writable',
  global:         'readonly',
  setTimeout:     'readonly',
  clearTimeout:   'readonly',
  setInterval:    'readonly',
  clearInterval:  'readonly',
  setImmediate:   'readonly',
  clearImmediate: 'readonly',
  URL:                'readonly',
  URLSearchParams:    'readonly',
  fetch:              'readonly',
  Response:           'readonly',
  Request:            'readonly',
  Headers:            'readonly',
  AbortController:    'readonly',
  AbortSignal:        'readonly',
  TextDecoder:        'readonly',
  TextEncoder:        'readonly',
  queueMicrotask:     'readonly',
  structuredClone:    'readonly',
};

const JEST_GLOBALS = {
  describe:   'readonly',
  it:         'readonly',
  test:       'readonly',
  expect:     'readonly',
  beforeAll:  'readonly',
  beforeEach: 'readonly',
  afterAll:   'readonly',
  afterEach:  'readonly',
  jest:       'readonly',
};

const BASELINE_RULES = {
  // Real-bug rules — hard errors.
  'no-undef':              'error',
  'no-unreachable':        'error',
  'no-dupe-keys':          'error',
  'no-dupe-else-if':       'error',
  'no-duplicate-case':     'error',
  'no-cond-assign':        'error',
  'no-self-assign':        'error',
  'no-self-compare':       'error',
  'use-isnan':             'error',
  'valid-typeof':          'error',
  'no-misleading-character-class': 'error',
  'no-promise-executor-return':    'error',
  'no-return-assign':              'error',
  'no-unsafe-finally':             'error',
  'no-unsafe-negation':            'error',
  'no-unsafe-optional-chaining':   'error',

  // Style / fluff — warnings only.
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  }],
  'no-empty':             ['error', { allowEmptyCatch: true }],
  'no-constant-condition':['error', { checkLoops: false }],
  'no-prototype-builtins':'off',   // common in dynamic JSON shaping
  'no-async-promise-executor': 'warn',
};

module.exports = [
  // Globally ignored — never lint generated or vendored code.
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'prisma/migrations/**',
      'uploads-dev/**',
    ],
  },

  // Application source under src/
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals:     NODE_GLOBALS,
    },
    rules: BASELINE_RULES,
  },

  // Tests get Jest globals on top of Node globals.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals:     { ...NODE_GLOBALS, ...JEST_GLOBALS },
    },
    rules: { ...BASELINE_RULES, 'no-unused-vars': 'off' },
  },

  // Prisma seed + Jest setup files live outside src/ and tests/.
  {
    files: ['prisma/seed.js', 'tests/globalSetup.js', 'tests/globalTeardown.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals:     NODE_GLOBALS,
    },
    rules: BASELINE_RULES,
  },
];
