require('dotenv').config({ path: '../.env' });
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { initSocket, closeSocket } = require('./sockets');
const prisma = require('./utils/prisma');
const redis = require('./utils/redis');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

initSocket(server);

// The Kafka consumer now runs in a separate worker (src/worker.js).
// In dev you can keep it inline by setting RUN_WORKER_INLINE=true.
if (process.env.RUN_WORKER_INLINE === 'true' && process.env.KAFKA_BROKERS) {
  const { startKafkaConsumer } = require('./jobs/locationConsumer');
  startKafkaConsumer().catch((err) => logger.error('Kafka consumer failed', err));
}

server.listen(PORT, () => {
  logger.info(`Field Force API listening on port ${PORT}`);
});

// --- Graceful shutdown ---
// On SIGTERM (ECS task stop, k8s pod evict, docker stop):
//   1. Stop accepting new HTTP connections
//   2. Drain Socket.IO clients
//   3. Close Prisma + Redis pools
//   4. Exit cleanly within 25s (ECS default grace = 30s)
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);
  const deadline = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 25_000);
  try {
    await new Promise((resolve) => server.close(resolve));
    logger.info('HTTP server closed');
    await closeSocket();
    logger.info('Socket.IO closed');
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
    redis.disconnect();
    logger.info('Redis disconnected');
    clearTimeout(deadline);
    process.exit(0);
  } catch (e) {
    logger.error('Error during shutdown', e);
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — process will exit', err);
  shutdown('UNCAUGHT_EXCEPTION');
});
