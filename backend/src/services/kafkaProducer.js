const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

let producer = null;

function getKafka() {
  if (!process.env.KAFKA_BROKERS) return null;
  if (producer) return producer;
  const kafka = new Kafka({
    clientId: 'fieldforce-api',
    brokers: process.env.KAFKA_BROKERS.split(','),
  });
  producer = kafka.producer();
  producer.connect().catch((e) => logger.error('Kafka connect failed', e));
  return producer;
}

async function publishLocation(payload) {
  const p = getKafka();
  if (!p) return;
  await p.send({
    topic: process.env.KAFKA_LOCATION_TOPIC || 'location-events',
    messages: [{ key: payload.userId, value: JSON.stringify(payload) }],
  });
}

module.exports = { publishLocation };
