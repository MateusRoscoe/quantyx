import { getLogger } from '@quantyx/shared-backend';
import { kafka } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env';

const consumer = kafka.consumer({
  groupId: environment.KAFKA_CONSUMER_GROUP_ID,
  sessionTimeout: environment.KAFKA_SESSION_TIMEOUT_MS,
});

export async function getAndConnectConsumer() {
  await consumer.connect();
  logger.info('Kafka consumer connected');
  return consumer;
}
