const router = require('express').Router();
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');

// Liveness — process is up. Used by ECS/k8s to decide if it needs a restart.
router.get('/live', (_req, res) => res.json({ status: 'live', pid: process.pid, ts: Date.now() }));

// Readiness — every external dependency is reachable. Used by load balancer.
router.get('/ready', async (_req, res) => {
  const checks = {};
  const start = Date.now();
  // Postgres
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (e) {
    checks.postgres = `fail: ${e.message}`;
  }
  // Redis
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : `fail: ${pong}`;
  } catch (e) {
    checks.redis = `fail: ${e.message}`;
  }
  // Kafka — optional dependency; report status but don't fail readiness on it
  if (process.env.KAFKA_BROKERS) {
    try {
      const { Kafka } = require('kafkajs');
      const k = new Kafka({ clientId: 'health', brokers: process.env.KAFKA_BROKERS.split(',') });
      const admin = k.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      checks.kafka = 'ok';
    } catch (e) {
      checks.kafka = `fail: ${e.message}`;
    }
  }

  const allOk = Object.entries(checks).every(([k, v]) => v === 'ok' || k === 'kafka');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'degraded',
    durationMs: Date.now() - start,
    checks,
  });
});

module.exports = router;
