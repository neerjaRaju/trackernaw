const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');
const routes = require('./routes');
const healthRoutes = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1); // ALB / CloudFront — trust X-Forwarded-* one hop in

// Strict security headers including CSP.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());

// Restrict CORS in production — wildcard is forbidden.
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin === '*')) {
  throw new Error('CORS_ORIGIN must be set to a specific origin in production');
}
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(requestId);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured JSON access logs with request ID + duration
app.use(morgan((tokens, req, res) => JSON.stringify({
  ts: new Date().toISOString(),
  reqId: req.id,
  method: tokens.method(req, res),
  url: tokens.url(req, res),
  status: Number(tokens.status(req, res)),
  durationMs: Number(tokens['response-time'](req, res)),
  ip: req.ip,
}), { stream: { write: (s) => logger.info(JSON.parse(s)) } }));

// Per-IP throttle on all API traffic
app.use('/api', rateLimit({
  windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests' },
}));

// Tighter limit on login — defense against credential stuffing
app.use('/api/v1/auth/login', rateLimit({
  windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Slow down.' },
}));

// Health (unauthenticated; not rate-limited)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.use('/health', healthRoutes); // /health/live and /health/ready

app.use('/api/v1', routes);
app.use(errorHandler);

module.exports = app;
