const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');
const { emitToCompany } = require('../sockets');

async function startKafkaConsumer() {
  if (!process.env.KAFKA_BROKERS) {
    logger.info('Kafka brokers not set, skipping consumer');
    return;
  }
  const kafka = new Kafka({
    clientId: 'fieldforce-gateway',
    brokers: process.env.KAFKA_BROKERS.split(','),
  });
  const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'fieldforce-gateway' });
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_LOCATION_TOPIC || 'location-events',
    fromBeginning: false,
  });
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        // Re-broadcast Flink-enriched events to dashboards
        if (evt.companyId) emitToCompany(evt.companyId, 'location:stream', evt);
      } catch (e) {
        logger.error('Bad kafka message', e);
      }
    },
  });
  logger.info('Kafka consumer started');
}

module.exports = { startKafkaConsumer };
