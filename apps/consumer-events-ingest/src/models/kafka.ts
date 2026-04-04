import { getLogger } from '@quantyx/shared-backend';
import { createConsumer } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env';

const consumer = createConsumer({
  'group.id': environment.KAFKA_CONSUMER_GROUP_ID,
  'session.timeout.ms': environment.KAFKA_SESSION_TIMEOUT_MS,
  'enable.auto.commit': false,
  'auto.offset.reset': environment.KAFKA_CONSUME_FROM_BEGINNING
    ? 'earliest'
    : 'latest',
  'fetch.min.bytes': environment.KAFKA_FETCH_MIN_BYTES,
  'fetch.wait.max.ms': environment.KAFKA_FETCH_WAIT_MAX_MS,
  'js.consumer.max.batch.size': environment.KAFKA_MAX_BATCH_SIZE,
});

export async function getAndConnectConsumer() {
  await consumer.connect();
  logger.info('Kafka consumer connected');
  return consumer;
}
