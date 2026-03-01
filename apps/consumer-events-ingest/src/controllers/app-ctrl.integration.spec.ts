import { Kafka, Producer } from 'kafkajs';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

const TOPIC = 'event-webhook-ingestion';

let producer: Producer;
let ch: ClickHouseClient;
let disconnectConsumer: () => Promise<void>;

function makeEventMessage(overrides: Record<string, unknown> = {}) {
  return {
    event_id: randomUUID(),
    project_id: randomUUID(),
    user_id: `user-${randomUUID().slice(0, 8)}`,
    session_id: randomUUID(),
    event_name: 'page_view',
    timestamp: new Date().toISOString(),
    ip_address: '192.168.1.1',
    ...overrides,
  };
}

async function pollClickHouse(
  projectId: string,
  expectedCount: number,
  timeoutMs = 15_000,
  intervalMs = 500
): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await ch.query({
      query: `SELECT * FROM analytics.events WHERE project_id = {projectId:String}`,
      query_params: { projectId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<Record<string, unknown>[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rows.length >= expectedCount) return rows as any;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} row(s) with project_id=${projectId}`
  );
}

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const brokers = process.env.KAFKA_BROKERS!.split(',');

  // Test producer — independent KafkaJS instance
  const kafka = new Kafka({
    clientId: 'integration-test-producer',
    brokers,
    retry: { retries: 3 },
  });
  producer = kafka.producer();
  await producer.connect();

  // ClickHouse client for assertions
  ch = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: 'analytics',
  });

  // Start the consumer once — dynamic import so module-level env reads
  // happen after globalSetup has set process.env
  const { AppCtrl } = await import('./app-ctrl.js');
  const { getAndConnectConsumer } = await import('../models/kafka.js');

  await AppCtrl.start();

  const consumer = await getAndConnectConsumer();
  disconnectConsumer = () => consumer.disconnect();
});

afterAll(async () => {
  await disconnectConsumer?.();
  await producer?.disconnect();
  await ch?.close();
});

describe('AppCtrl integration (Kafka → ClickHouse)', () => {
  it('single event flows from Kafka to ClickHouse', async () => {
    const event = makeEventMessage();

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(event) }],
    });

    const rows = await pollClickHouse(event.project_id as string, 1);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event_id: event.event_id,
      project_id: event.project_id,
      user_id: event.user_id,
      session_id: event.session_id,
      event_name: 'page_view',
      ip_address: '::ffff:192.168.1.1',
    });
  });

  it('batch of events all land in ClickHouse', async () => {
    const projectId = randomUUID();
    const events = Array.from({ length: 5 }, () =>
      makeEventMessage({ project_id: projectId })
    );

    await producer.send({
      topic: TOPIC,
      messages: events.map((e) => ({ value: JSON.stringify(e) })),
    });

    const rows = await pollClickHouse(projectId, 5);

    expect(rows).toHaveLength(5);
    const insertedIds = new Set(rows.map((r) => r.event_id));
    for (const event of events) {
      expect(insertedIds).toContain(event.event_id);
    }
  });

  it('event with only required fields gets correct defaults in ClickHouse', async () => {
    // Omit ip_address to verify the '::' default
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ip_address: _, ...eventWithoutIp } = makeEventMessage();
    const event = eventWithoutIp;

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(event) }],
    });

    const rows = await pollClickHouse(event.project_id as string, 1);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.country).toBe('');
    expect(row.continent).toBe('');
    expect(row.city).toBe('');
    expect(row.browser).toBe('');
    expect(row.device_type).toBe('');
    expect(row.user_agent).toBe('');
    expect(row.ip_address).toBe('::');
    expect(row.props_str).toEqual({});
    expect(row.props_num).toEqual({});
    expect(row.props_bool).toEqual({});
  });

  it('malformed message in batch — consumer logs error and continues', async () => {
    const projectId = randomUUID();
    const malformed = 'not-valid-json{{{';
    const validEvent = makeEventMessage({ project_id: projectId });

    // Send the malformed message first
    await producer.send({
      topic: TOPIC,
      messages: [{ value: malformed }],
    });

    // Wait a moment for the consumer to process (and fail on) the malformed message
    await new Promise((r) => setTimeout(r, 3000));

    // Now send a valid event — consumer should still be alive
    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(validEvent) }],
    });

    const rows = await pollClickHouse(projectId, 1);

    expect(rows).toHaveLength(1);
    expect(rows[0].event_id).toBe(validEvent.event_id);
  });
});
