import { KafkaContainer } from '@testcontainers/kafka';
import { GenericContainer, Wait } from 'testcontainers';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import * as fs from 'fs';
import * as path from 'path';

const TOPIC = 'event-webhook-ingestion';
let kafkaContainer: Awaited<ReturnType<KafkaContainer['start']>>;
let clickhouseContainer: Awaited<ReturnType<GenericContainer['start']>>;

async function waitForKafkaReady(brokers: string[], maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const kafka = new KafkaJS.Kafka();
    const admin = kafka.admin({
      'bootstrap.servers': brokers.join(','),
      'client.id': 'test-setup',
    });

    try {
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic: TOPIC, numPartitions: 1, replicationFactor: 1 }],
      });
      await admin.disconnect();
      return;
    } catch {
      await admin.disconnect().catch(() => {
        /* ignore */
      });
      if (attempt === maxAttempts) {
        throw new Error(`Kafka broker not ready after ${maxAttempts} attempts`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function setup() {
  const [kafka, clickhouse] = await Promise.all([
    new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9093)
      .withStartupTimeout(60_000)
      .start(),
    new GenericContainer('clickhouse/clickhouse-server:25.11-alpine')
      .withExposedPorts(8123)
      .withEnvironment({ CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: '1' })
      .withWaitStrategy(Wait.forHttp('/ping', 8123).forStatusCode(200))
      .withStartupTimeout(60_000)
      .start(),
  ]);

  kafkaContainer = kafka;
  clickhouseContainer = clickhouse;

  // Set up Kafka
  const brokers = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;
  await waitForKafkaReady([brokers]);

  // Initialize ClickHouse schema
  const chHost = clickhouseContainer.getHost();
  const chPort = clickhouseContainer.getMappedPort(8123);
  const chUrl = `http://${chHost}:${chPort}`;

  const initSql = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      '../../infrastructure/clickhouse/init/01_create_tables.sql',
    ),
    'utf-8',
  );

  // ClickHouse HTTP interface doesn't support multiple statements in one request.
  // Split on semicolons and execute each statement individually.
  const statements = initSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);

  for (const stmt of statements) {
    const resp = await fetch(chUrl, {
      method: 'POST',
      body: stmt,
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`ClickHouse init failed (${resp.status}): ${body}`);
    }
  }

  // Export env vars for test workers
  process.env.KAFKA_BROKERS = brokers;
  process.env.KAFKA_CLIENT_ID = 'consumer-test';
  process.env.KAFKA_CONSUME_FROM_BEGINNING = 'true';

  process.env.CLICKHOUSE_URL = chUrl;
  process.env.CLICKHOUSE_USER = 'default';
  process.env.CLICKHOUSE_PASSWORD = '';
  process.env.CLICKHOUSE_DATABASE = 'analytics';
}

export async function teardown() {
  await Promise.all([kafkaContainer?.stop(), clickhouseContainer?.stop()]);
}
