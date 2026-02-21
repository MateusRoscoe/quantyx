import { createClient } from '@clickhouse/client';
import type { EventMessage } from './schema';

// Initialize ClickHouse client
const clickhouse = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: 'analytics',
  request_timeout: 30000,
  compression: {
    request: true,
    response: true,
  },
});

/**
 * Transform EventMessage to ClickHouse format
 */
function transformEvent(event: EventMessage) {
  return {
    event_id: event.event_id,
    tenant_id: event.tenant_id,
    user_id: event.user_id,
    session_id: event.session_id,
    event_name: event.event_name,
    timestamp: event.timestamp,
    date: event.date || event.timestamp.split('T')[0],
    country: event.country || '',
    continent: event.continent || '',
    region: event.region || '',
    state: event.state || '',
    city: event.city || '',
    device_type: event.device_type || '',
    platform: event.platform || '',
    browser: event.browser || '',
    browser_version: event.browser_version || '',
    os: event.os || '',
    os_version: event.os_version || '',
    props_str: event.props_str || {},
    props_num: event.props_num || {},
    props_bool: event.props_bool
      ? Object.fromEntries(
          Object.entries(event.props_bool).map(([k, v]) => [k, v ? 1 : 0])
        )
      : {},
    ip_address: event.ip_address,
    user_agent: event.user_agent || '',
  };
}

/**
 * Insert a single event
 */
export async function insertEvent(event: EventMessage): Promise<void> {
  const transformed = transformEvent(event);

  await clickhouse.insert({
    table: 'analytics.events',
    values: [transformed],
    format: 'JSONEachRow',
  });
}

/**
 * Batch insert events (recommended for better performance)
 */
export async function insertEventsBatch(events: EventMessage[]): Promise<void> {
  if (events.length === 0) return;

  const transformed = events.map(transformEvent);

  await clickhouse.insert({
    table: 'analytics.events',
    values: transformed,
    format: 'JSONEachRow',
  });
}

/**
 * Batch inserter with automatic flushing
 */
export class EventBatchInserter {
  private batch: EventMessage[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private maxBatchSize: number = 1000,
    private maxWaitMs: number = 5000
  ) {}

  async add(event: EventMessage): Promise<void> {
    this.batch.push(event);

    // Schedule flush if not already scheduled
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
    }

    // Flush if batch is full
    if (this.batch.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) return;

    const toInsert = this.batch;
    this.batch = [];

    try {
      await insertEventsBatch(toInsert);
      console.log(`✓ Inserted ${toInsert.length} events`);
    } catch (error) {
      console.error('Failed to insert batch:', error);
      // Re-add failed events to batch for retry
      this.batch.unshift(...toInsert);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.flush();
    await clickhouse.close();
  }
}

/**
 * Example Kafka consumer integration
 */
export async function consumeAndInsert() {
  const { Kafka } = await import('kafkajs');

  const kafka = new Kafka({
    clientId: 'analytics-consumer',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  });

  const consumer = kafka.consumer({ groupId: 'analytics-group' });
  const inserter = new EventBatchInserter(1000, 5000);

  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_TOPIC || 'events',
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}');
        await inserter.add(event);
      } catch (error) {
        console.error('Failed to process message:', error);
      }
    },
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await consumer.disconnect();
    await inserter.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run if this is the main module
if (require.main === module) {
  consumeAndInsert().catch(console.error);
}
