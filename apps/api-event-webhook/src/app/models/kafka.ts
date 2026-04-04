import type { EventMessage } from '@quantyx/shared';
import { getLogger } from '@quantyx/shared-backend';
import { kafka } from '@quantyx/kafka';

const logger = getLogger('kafka');

import { environment } from '../helpers/env.js';

import { CompressionTypes } from 'kafkajs';

const buffer: EventMessage[] = [];
let flushTimer: ReturnType<typeof setTimeout>;
let flushInProgress: Promise<void> | null = null;
let isDisconnecting = false;

const maxBufferCapacity =
  environment.EVENTS_MAX_BUFFER_SIZE *
  environment.EVENTS_BUFFER_CAPACITY_MULTIPLIER;

const producer = kafka.producer();

export async function connectProducer() {
  await producer.connect();
  scheduleFlush();
}

export async function disconnectProducer() {
  if (isDisconnecting) return;
  isDisconnecting = true;
  clearTimeout(flushTimer);

  // Wait for any in-flight flush, then drain remaining buffer
  if (flushInProgress) await flushInProgress;
  await drainBuffer();

  await producer.disconnect();
}

export function getBufferStatus() {
  return {
    size: buffer.length,
    capacity: maxBufferCapacity,
    isFlushing: flushInProgress !== null,
  };
}

export function sendEvent(event: EventMessage) {
  if (buffer.length >= maxBufferCapacity) {
    throw new BufferFullError(buffer.length);
  }
  buffer.push(event);
  if (buffer.length >= environment.EVENTS_MAX_BUFFER_SIZE) {
    triggerFlush();
  }
}

export function sendEventBulk(events: EventMessage[]) {
  if (buffer.length + events.length > maxBufferCapacity) {
    throw new BufferFullError(buffer.length);
  }
  buffer.push(...events);
  if (buffer.length >= environment.EVENTS_MAX_BUFFER_SIZE) {
    triggerFlush();
  }
}

export class BufferFullError extends Error {
  constructor(currentSize: number) {
    super(
      `Event buffer is full (${currentSize}/${maxBufferCapacity}). Try again later.`
    );
    this.name = 'BufferFullError';
  }
}

function triggerFlush() {
  // If a flush is already running, don't stack another —
  // the in-flight flush finishing will re-check the buffer.
  if (flushInProgress) return;

  flushInProgress = flush()
    .catch((error) => logger.error(error, 'Error flushing events to Kafka'))
    .finally(() => {
      flushInProgress = null;
      // If events accumulated during the flush, flush again immediately
      if (buffer.length >= environment.EVENTS_MAX_BUFFER_SIZE) {
        triggerFlush();
      }
    });
}

async function flush() {
  if (buffer.length === 0) return;

  // Take at most EVENTS_MAX_BUFFER_SIZE events to keep batch size bounded
  const batch = buffer.splice(0, environment.EVENTS_MAX_BUFFER_SIZE);
  logger.debug(`Flushing ${batch.length} events to Kafka`);

  await producer.send({
    topic: environment.EVENT_TOPIC,
    acks: environment.KAFKA_PRODUCER_ACKS,
    messages: batch.map((event) => ({
      value: JSON.stringify(event),
    })),
    compression: CompressionTypes.LZ4,
  });

  logger.debug('Flush complete');
  scheduleFlush();
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    triggerFlush();
  }, environment.EVENTS_BUFFER_FLUSH_INTERVAL);
}

async function drainBuffer() {
  for (let attempt = 0; buffer.length > 0 && attempt < 10; attempt++) {
    logger.warn(
      `${buffer.length} unsent events in buffer, retrying flush (${
        attempt + 1
      }/10)`
    );
    try {
      await flush();
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (buffer.length > 0) {
    logger.error(
      `Dropping ${buffer.length} events — failed to flush before shutdown`
    );
  }
}
