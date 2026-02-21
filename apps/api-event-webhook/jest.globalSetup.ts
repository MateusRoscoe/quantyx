import { KafkaContainer } from '@testcontainers/kafka';
import { Kafka } from 'kafkajs';

const TOPIC = 'event-webhook-ingestion';

declare global {
  // eslint-disable-next-line no-var
  var __KAFKA_CONTAINER__: Awaited<
    ReturnType<KafkaContainer['start']>
  >;
}

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
      await admin.disconnect().catch(() => {});
      if (attempt === maxAttempts) {
        throw new Error(
          `Kafka broker not ready after ${maxAttempts} attempts`
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export default async function () {
  const container = await new KafkaContainer('confluentinc/cp-kafka:7.5.0')
    .withExposedPorts(9093)
    .withStartupTimeout(60_000)
    .start();

  const brokers = `${container.getHost()}:${container.getMappedPort(9093)}`;

  await waitForKafkaReady([brokers]);

  process.env.KAFKA_BROKERS = brokers;
  process.env.EVENTS_MAX_BUFFER_SIZE = '1';
  process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

  globalThis.__KAFKA_CONTAINER__ = container;
}
