import { Kafka, SASLOptions } from 'kafkajs';
import type { EventMessage } from '@quantyx/shared';
import { getLogger } from '../helpers/logger.js';

const logger = getLogger('kafka');

import { environment } from '../helpers/env.js';

import { CompressionTypes } from 'kafkajs';

const eventsBuffer: EventMessage[] = [];

const kafka = new Kafka({
  clientId: environment.KAFKA_CLIENT_ID,
  brokers: environment.KAFKA_BROKERS.split(','),
  ssl: environment.KAFKA_SSL_ENABLED,
  sasl: environment.KAFKA_SASL_MECHANISM
    ? ({
        mechanism: environment.KAFKA_SASL_MECHANISM,
        username: environment.KAFKA_SASL_USERNAME,
        password: environment.KAFKA_SASL_PASSWORD,
      } as SASLOptions)
    : undefined,
});

const producer = kafka.producer();

export async function connectProducer() {
  await producer.connect();
}

export async function disconnectProducer() {
  await producer.disconnect();
}

export async function sendEvent(event: EventMessage | EventMessage[]) {
  if (Array.isArray(event)) {
    eventsBuffer.push(...event);
  } else {
    eventsBuffer.push(event);
  }
  if (eventsBuffer.length >= environment.EVENTS_MAX_BUFFER_SIZE) {
    flushBuffer().catch((error) => {
      console.error('Error flushing events buffer:', error);
    });
  }
}

let isFlushing = false;

const flushBuffer = async () => {
  if (eventsBuffer.length > 0 && !isFlushing) {
    isFlushing = true;
    logger.debug(`Flushing ${eventsBuffer.length} events to Kafka`);
    const eventsToSend = eventsBuffer.splice(0, eventsBuffer.length);
    await producer.send({
      topic: environment.EVENT_TOPIC,
      messages: eventsToSend.map((event) => ({
        value: JSON.stringify(event),
      })),
      compression: CompressionTypes.GZIP,
    });
    logger.debug('Flush complete');
    isFlushing = false;
  }
  flushTimeout.refresh();
};

export const flushTimeout = setTimeout(async () => {
  flushBuffer().catch((error) => {
    logger.error('Error flushing events buffer:', error);
  });
}, environment.EVENTS_BUFFER_FLUSH_INTERVAL);
