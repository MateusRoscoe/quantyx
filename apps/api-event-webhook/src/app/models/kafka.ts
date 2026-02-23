import type { EventMessage } from '@quantyx/shared';
import { getLogger } from '@quantyx/shared-backend';
import { kafka } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env.js';

import { CompressionTypes } from 'kafkajs';

const eventsBuffer: EventMessage[] = [];

const producer = kafka.producer();

export async function connectProducer() {
  await producer.connect();
}

let isDisconnecting = false;

export async function disconnectProducer() {
  if (isDisconnecting) return;
  isDisconnecting = true;
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  await flushBuffer();
  for (let i = 0; eventsBuffer.length > 0 && i < 10; i += 1) {
    logger.warn(
      `Still have ${
        eventsBuffer.length
      } unsent events in buffer. Retrying flush... (${i + 1}/10)`
    );
    await sleep(1000);
    await flushBuffer();
  }

  if (eventsBuffer.length > 0) {
    logger.error(
      `Failed to flush all events before shutdown. Dropping ${eventsBuffer.length} events.`
    );
  }

  await producer.disconnect();
}

async function checkFlush() {
  if (eventsBuffer.length >= environment.EVENTS_MAX_BUFFER_SIZE) {
    flushBuffer().catch((error) => {
      console.error('Error flushing events buffer:', error);
    });
  }
}
export async function sendEvent(event: EventMessage) {
  eventsBuffer.push(event);
  checkFlush();
}

export async function sendEventBulk(event: EventMessage[]) {
  eventsBuffer.push(...event);
  checkFlush();
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

const flushTimeout = setTimeout(async () => {
  flushBuffer().catch((error) => {
    logger.error('Error flushing events buffer:', error);
  });
}, environment.EVENTS_BUFFER_FLUSH_INTERVAL);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
