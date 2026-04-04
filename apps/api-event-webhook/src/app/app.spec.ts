import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import { app } from './app';
import { connectProducer, disconnectProducer } from './models/kafka';
import { environment } from './helpers/env';
import { prisma } from '@quantyx/postgres';
import { generateApiKey } from '@quantyx/shared-backend';
import { disconnectRedis } from '@quantyx/redis';

let server: FastifyInstance;
let apiKey: string;
let projectId: string;

// Generate a proper UUIDv7
function uuidv7(): string {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');

  const rand = new Uint8Array(10);
  crypto.getRandomValues(rand);
  const randHex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Format: tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
  const uuid = [
    timeHex.slice(0, 8),
    timeHex.slice(8, 12),
    '7' + randHex.slice(0, 3),
    ((parseInt(randHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) +
      randHex.slice(4, 7),
    randHex.slice(7, 19).padEnd(12, '0'),
  ].join('-');

  return uuid;
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: uuidv7(),
    session_id: uuidv7(),
    user_id: 'test-user',
    event_name: 'page_view',
    timestamp: new Date().toISOString().replace(/(\.\d{3})\d*Z$/, '$1Z'),
    ...overrides,
  };
}

beforeAll(async () => {
  // Create org → project → API key for testing
  const org = await prisma.organization.create({
    data: { name: 'Test Org' },
  });
  const project = await prisma.project.create({
    data: { name: 'Test Project', organizationId: org.id },
  });
  projectId = project.id;

  const generated = generateApiKey();
  apiKey = generated.key;

  await prisma.apiKey.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      name: 'Test Key',
      prefix: generated.prefix,
      keyHash: generated.keyHash,
    },
  });

  server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(app);
  await server.ready();
  await connectProducer();
});

afterAll(async () => {
  await disconnectProducer();
  await disconnectRedis();
  await prisma.$disconnect();
  await server.close();
});

describe('GET /healthz/live', () => {
  it('should return 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthz/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });
});

describe('GET /healthz/ready', () => {
  it('should return 200 when buffer has capacity', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthz/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });
});

describe('GET /healthz/startup', () => {
  it('should return 200 when dependencies are connected', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthz/startup',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
    expect(response.json().dependencies.kafka).toBe('connected');
  });
});

describe('POST /ingest', () => {
  it('should return 204 with valid payload and API key', async () => {
    const event = makeEvent();

    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: event,
      headers: { 'x-api-key': apiKey },
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 401 without API key', async () => {
    const event = makeEvent();

    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: event,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 with invalid API key', async () => {
    const event = makeEvent();

    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: event,
      headers: { 'x-api-key': 'qx_invalid_key_here' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 with expired API key', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Expired Org' },
    });
    const proj = await prisma.project.create({
      data: { name: 'Expired Project', organizationId: org.id },
    });
    const expired = generateApiKey();
    await prisma.apiKey.create({
      data: {
        projectId: proj.id,
        organizationId: org.id,
        name: 'Expired Key',
        prefix: expired.prefix,
        keyHash: expired.keyHash,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      },
    });

    const event = makeEvent();
    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: event,
      headers: { 'x-api-key': expired.key },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 with invalid payload', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: { invalid: true },
      headers: { 'x-api-key': apiKey },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: {
        event_name: 'test',
        // missing event_id, session_id, user_id, timestamp
      },
      headers: { 'x-api-key': apiKey },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /ingest-bulk', () => {
  it('should return 204 with valid array payload', async () => {
    const events = [makeEvent(), makeEvent({ event_name: 'click' })];

    const response = await server.inject({
      method: 'POST',
      url: '/ingest-bulk',
      payload: events,
      headers: { 'x-api-key': apiKey },
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 400 with invalid array payload', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/ingest-bulk',
      payload: [{ invalid: true }],
      headers: { 'x-api-key': apiKey },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Kafka message verification', () => {
  it('should produce messages to Kafka topic with project_id', async () => {
    const event = makeEvent({ event_name: 'kafka_verify_test' });

    const response = await server.inject({
      method: 'POST',
      url: '/ingest',
      payload: event,
      headers: { 'x-api-key': apiKey },
    });
    expect(response.statusCode).toBe(204);

    // Give the producer a moment to flush
    await new Promise((r) => setTimeout(r, 2000));

    // Consume the message from Kafka
    const kafkaClient = new Kafka({
      clientId: 'test-consumer',
      brokers: (process.env.KAFKA_BROKERS ?? '').split(','),
    });

    const consumer = kafkaClient.consumer({
      groupId: `test-group-${randomUUID()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: environment.EVENT_TOPIC,
      fromBeginning: true,
    });

    const messages: string[] = [];

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 10000);

      consumer.run({
        eachMessage: async ({ message }) => {
          if (message.value) {
            messages.push(message.value.toString());
          }
          // We found at least one message with our event_name
          const found = messages.some((m) => {
            try {
              const parsed = JSON.parse(m);
              return parsed.event_name === 'kafka_verify_test';
            } catch {
              return false;
            }
          });
          if (found) {
            clearTimeout(timeout);
            resolve();
          }
        },
      });
    });

    await consumer.disconnect();

    const matchingMessages = messages.filter((m) => {
      try {
        const parsed = JSON.parse(m);
        return parsed.event_name === 'kafka_verify_test';
      } catch {
        return false;
      }
    });

    expect(matchingMessages.length).toBeGreaterThanOrEqual(1);

    const parsed = JSON.parse(matchingMessages[0]);
    expect(parsed.event_id).toBe(event.event_id);
    expect(parsed.user_id).toBe(event.user_id);
    expect(parsed.project_id).toBe(projectId);
    expect(parsed.ip_address).toBeDefined();
  });
});
