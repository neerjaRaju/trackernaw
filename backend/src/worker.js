/**
 * Standalone worker process — runs the Kafka consumer for the enriched
 * location stream and rebroadcasts to Socket.IO via the Redis adapter
 * (so events reach clients connected to *any* API replica).
 *
 * Run with: `npm run worker`  (script defined in package.json)
 *
 * Deploy as a separate ECS service or k8s deployment, scaled by Kafka lag.
 * The API service does NOT run this loop, so a backlogged consumer can't
 * drag down request latency.
 */
require('dotenv').config({ path: '../.env' });
const logger = require('./utils/logger');
const prisma = require('./utils/prisma');
const redis = require('./utils/redis');

if (!process.env.KAFKA_BROKERS) {
  logger.error('Worker requires KAFKA_BROKERS to be set. Exiting.');
  process.exit(1);
}

const { Kafka } = require('kafkajs');
const { createClient } = require('redis');

async function main() {
  // Connect a Redis pub client so we can fan out to Socket.IO across nodes.
  const pub = createClient({ url: process.env.REDIS_URL });
  await pub.connect();

  const kafka = new Kafka({
    clientId: 'fieldforce-worker',
    brokers: process.env.KAFKA_BROKERS.split(','),
  });
  const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'fieldforce-worker',
  });
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_LOCATION_TOPIC || 'location-enriched',
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        if (!evt.companyId) return;
        // Publish to Socket.IO Redis adapter channel — every connected API node
        // will receive this and forward to local sockets in the company room.
        await pub.publish(`socketio#/#company:${evt.companyId}#`, JSON.stringify({
          type: 2,
          data: ['location:stream', evt],
        }));
      } catch (e) {
        logger.error('Bad kafka message in worker', e);
      }
    },
  });

  logger.info('Worker started — consuming location-enriched');

  // --- Graceful shutdown ---
  async function shutdown(signal) {
    logger.info(`Worker received ${signal}, shutting down`);
    try {
      await consumer.disconnect();
      await pub.disconnect();
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    } catch (e) {
      logger.error('Worker shutdown error', e);
      process.exit(1);
    }
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch((e) => { logger.error('Worker fatal error', e); process.exit(1); });
