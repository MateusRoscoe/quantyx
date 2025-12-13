import { Kafka } from 'kafkajs';
import type { EventMessage } from '@quantyx/shared';
import { getLogger } from '../helpers/logger.js';

const logger = getLogger('kafka');

const EVENT_TOPIC = process.env.EVENT_TOPIC ?? '';

if (!EVENT_TOPIC || EVENT_TOPIC.length === 0) {
  throw new Error('EVENT_TOPIC is not defined in environment variables');
}

import { CompressionTypes, CompressionCodecs } from 'kafkajs';
import LZ4 from 'kafkajs-lz4';

CompressionCodecs[CompressionTypes.LZ4] = new LZ4().codec;

const eventsBuffer = [] as EventMessage[];
const MAX_BUFFER_SIZE = process.env.EVENTS_MAX_BUFFER_SIZE
  ? parseInt(process.env.EVENTS_MAX_BUFFER_SIZE)
  : 100;
const BUFFER_FLUSH_INTERVAL = process.env.EVENTS_BUFFER_FLUSH_INTERVAL
  ? parseInt(process.env.EVENTS_BUFFER_FLUSH_INTERVAL)
  : 5000;

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['kafka1:9092', 'kafka2:9092'],
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
  if (eventsBuffer.length >= MAX_BUFFER_SIZE) {
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
    await sendEvent(eventsToSend);
    isFlushing = false;
  }
  flushTimeout.refresh();
};

export const flushTimeout = setTimeout(async () => {
  flushBuffer().catch((error) => {
    logger.error('Error flushing events buffer:', error);
  });
}, BUFFER_FLUSH_INTERVAL);
