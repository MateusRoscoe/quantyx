import { getLogger } from '@quantyx/shared-backend';
import { createNativeProducer } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env.js';

const producer = createNativeProducer({
  'compression.type': 'lz4',
  'linger.ms': environment.KAFKA_LINGER_MS,
  'batch.size': environment.KAFKA_BATCH_SIZE,
  'request.required.acks': environment.KAFKA_PRODUCER_ACKS,
  'queue.buffering.max.messages': environment.KAFKA_BACKPRESSURE_THRESHOLD,
  dr_cb: true,
});

let inFlightCount = 0;
let messagesSinceGc = 0;
let lastGcTime = Date.now();

function maybeForceGc() {
  if (typeof globalThis.gc !== 'function') return;
  const { GC_MESSAGE_THRESHOLD, GC_INTERVAL_MS } = environment;
  if (GC_MESSAGE_THRESHOLD === 0 && GC_INTERVAL_MS === 0) return;

  const elapsed = Date.now() - lastGcTime;
  if (
    (GC_MESSAGE_THRESHOLD > 0 && messagesSinceGc >= GC_MESSAGE_THRESHOLD) ||
    (GC_INTERVAL_MS > 0 && elapsed >= GC_INTERVAL_MS)
  ) {
    globalThis.gc();
    messagesSinceGc = 0;
    lastGcTime = Date.now();
  }
}

producer.on('delivery-report', (_err, _report) => {
  inFlightCount--;
  if (_err) {
    logger.error(_err, 'Kafka delivery failed');
  }
});

producer.on('event.error', (err) => {
  logger.error(err, 'Kafka producer error');
});

export function connectProducer(): Promise<void> {
  return new Promise((resolve, reject) => {
    producer.on('ready', () => {
      logger.info('Kafka producer connected');
      resolve();
    });
    producer.on('event.error', reject);
    producer.connect();
    producer.setPollInterval(100);
  });
}

export function disconnectProducer(): Promise<void> {
  return new Promise((resolve) => {
    producer.flush(10000, () => {
      producer.disconnect(() => resolve());
    });
  });
}

export function getProducerStatus() {
  return { inFlightCount };
}

export function sendMessages(messages: Buffer[]) {
  const topic = environment.EVENT_TOPIC;
  const now = Date.now();
  for (let i = 0; i < messages.length; i++) {
    try {
      producer.produce(topic, null, messages[i], null, now);
      inFlightCount++;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Queue full')) {
        throw new BackpressureError();
      }
      throw err;
    }
  }
  messagesSinceGc += messages.length;
  maybeForceGc();
}

export class BackpressureError extends Error {
  constructor() {
    super('API is at capacity. Please try again later.');
    this.name = 'BackpressureError';
  }
}
