import { KafkaContainer } from '@testcontainers/kafka';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { Kafka } from 'kafkajs';
import { execSync } from 'child_process';
import * as path from 'path';

const TOPIC = 'event-webhook-ingestion';
let kafkaContainer: Awaited<ReturnType<KafkaContainer['start']>>;
let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
let redisContainer: Awaited<ReturnType<GenericContainer['start']>>;

async function waitForKafkaReady(brokers: string[], maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const kafka = new Kafka({
      clientId: 'test-setup',
      brokers,
      retry: { retries: 0 },
    });
    const admin = kafka.admin();

    try {
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
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
  // Start all containers in parallel
  const [kafka, pg, redis] = await Promise.all([
    new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9093)
      .withStartupTimeout(60_000)
      .start(),
    new PostgreSqlContainer('postgres:18-trixie')
      .withDatabase('quantyx_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .withStartupTimeout(60_000)
      .start(),
    new GenericContainer('redis:8-alpine')
      .withExposedPorts(6379)
      .withStartupTimeout(30_000)
      .start(),
  ]);

  kafkaContainer = kafka;
  pgContainer = pg;
  redisContainer = redis;

  const brokers = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(
    9093,
  )}`;
  await waitForKafkaReady([brokers]);

  const connectionUri = pgContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(
    6379,
  )}`;

  process.env.KAFKA_BROKERS = brokers;
  process.env.EVENTS_MAX_BUFFER_SIZE = '1';
  process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
  process.env.DATABASE_URL = connectionUri;
  process.env.POSTGRES_URL = connectionUri;
  process.env.REDIS_URL = redisUrl;
  process.env.API_KEY_CACHE_TTL_SECONDS = '300';

  // Apply Prisma migrations
  const postgresLibPath = path.resolve(
    import.meta.dirname,
    '../../libs/postgres',
  );
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env },
    cwd: postgresLibPath,
    stdio: 'inherit',
  });
}

export async function teardown() {
  await Promise.all([
    kafkaContainer?.stop(),
    pgContainer?.stop(),
    redisContainer?.stop(),
  ]);
}
