import { getLogger } from '@quantyx/shared-backend';
import { createProducer } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env.js';

const producer = createProducer({
  'compression.type': 'lz4',
  'linger.ms': environment.KAFKA_LINGER_MS,
  'batch.size': environment.KAFKA_BATCH_SIZE,
  'request.required.acks': String(environment.KAFKA_PRODUCER_ACKS),
  'queue.buffering.max.messages': environment.KAFKA_BACKPRESSURE_THRESHOLD,
});

let inFlightCount = 0;

export async function connectProducer() {
  await producer.connect();
  logger.info('Kafka producer connected');
}

export async function disconnectProducer() {
  await producer.disconnect();
}

export function getProducerStatus() {
  return { inFlightCount };
}

export function sendMessages(messages: { value: string }[]) {
  inFlightCount += messages.length;
  producer
    .send({
      topic: environment.EVENT_TOPIC,
      messages,
    })
    .catch((err: unknown) =>
      logger.error(err, 'Failed to deliver events to Kafka')
    )
    .finally(() => (inFlightCount -= messages.length));
}
