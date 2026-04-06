import { KafkaJS } from '@confluentinc/kafka-javascript';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

const TOPIC = 'event-webhook-ingestion';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let producer: any;
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
  intervalMs = 500,
): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await ch.query({
      query: `SELECT * FROM analytics.events WHERE project_id = {projectId:String}`,
      query_params: { projectId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<Record<string, unknown>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rows.length >= expectedCount) return rows as any;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} row(s) with project_id=${projectId}`,
  );
}

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const brokers = process.env.KAFKA_BROKERS!.split(',');

  // Test producer — independent Kafka instance
  const kafka = new KafkaJS.Kafka();
  producer = kafka.producer({
    'bootstrap.servers': brokers.join(','),
    'client.id': 'integration-test-producer',
  });
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
      makeEventMessage({ project_id: projectId }),
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

  it('materialized view populates analytics.users on event insert', async () => {
    const projectId = randomUUID();
    const userId = `user-${randomUUID().slice(0, 8)}`;

    const events = [
      makeEventMessage({
        project_id: projectId,
        user_id: userId,
        event_name: 'page_view',
        props_str: { path: '/home' },
        props_num: { score: 42 },
        props_bool: { is_premium: true },
      }),
      makeEventMessage({
        project_id: projectId,
        user_id: userId,
        event_name: 'click',
      }),
    ];

    await producer.send({
      topic: TOPIC,
      messages: events.map((e) => ({ value: JSON.stringify(e) })),
    });

    // Wait for events to land in the events table
    await pollClickHouse(projectId, 2);

    // Poll the users aggregate table
    const deadline = Date.now() + 15_000;
    let userRows: Record<string, unknown>[] = [];
    while (Date.now() < deadline) {
      const result = await ch.query({
        query: `
          SELECT
            project_id,
            user_id,
            min(first_seen) AS first_seen,
            max(last_seen) AS last_seen,
            sum(total_events) AS total_events
          FROM analytics.users
          WHERE project_id = {projectId:String} AND user_id = {userId:String}
          GROUP BY project_id, user_id
        `,
        query_params: { projectId, userId },
        format: 'JSONEachRow',
      });
      userRows = await result.json<Record<string, unknown>>();
      if (userRows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(userRows).toHaveLength(1);
    expect(userRows[0].project_id).toBe(projectId);
    expect(userRows[0].user_id).toBe(userId);
    expect(Number(userRows[0].total_events)).toBe(2);
    // first_seen and last_seen should be valid date strings
    expect(userRows[0].first_seen).toBeDefined();
    expect(userRows[0].last_seen).toBeDefined();
  });

  it('anonymous events (empty user_id) are excluded from analytics.users', async () => {
    const projectId = randomUUID();

    const event = makeEventMessage({
      project_id: projectId,
      user_id: '',
      event_name: 'page_view',
    });

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(event) }],
    });

    await pollClickHouse(projectId, 1);

    // Give MV a moment to process, then check users is empty for this project
    await new Promise((r) => setTimeout(r, 2000));

    const result = await ch.query({
      query: `
        SELECT count() AS cnt
        FROM analytics.users
        WHERE project_id = {projectId:String}
      `,
      query_params: { projectId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ cnt: string }>();
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('materialized view populates analytics.metrics_hourly with dimension rows', async () => {
    const projectId = randomUUID();
    const userId = `user-${randomUUID().slice(0, 8)}`;

    const events = [
      makeEventMessage({
        project_id: projectId,
        user_id: userId,
        event_name: 'page_view',
        browser: 'Chrome',
        props_str: { path: '/about' },
      }),
      makeEventMessage({
        project_id: projectId,
        user_id: userId,
        event_name: 'click',
        browser: 'Chrome',
      }),
    ];

    await producer.send({
      topic: TOPIC,
      messages: events.map((e) => ({ value: JSON.stringify(e) })),
    });

    await pollClickHouse(projectId, 2);

    // Poll metrics_hourly for the 'overall' dimension
    const deadline = Date.now() + 15_000;
    let metricRows: Record<string, unknown>[] = [];
    while (Date.now() < deadline) {
      const result = await ch.query({
        query: `
          SELECT
            dimension_name,
            dimension_value,
            sumMerge(event_count) AS event_count
          FROM analytics.metrics_hourly
          WHERE project_id = {projectId:String}
          GROUP BY dimension_name, dimension_value
          ORDER BY dimension_name, event_count DESC
        `,
        query_params: { projectId },
        format: 'JSONEachRow',
      });
      metricRows = await result.json<Record<string, unknown>>();
      if (metricRows.length >= 3) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // Should have overall, event_name (page_view, click), browser (Chrome), path (/about)
    const dimensions = metricRows.map((r) => r.dimension_name);
    expect(dimensions).toContain('overall');
    expect(dimensions).toContain('event_name');
    expect(dimensions).toContain('browser');

    // Overall count should be 2
    const overall = metricRows.find((r) => r.dimension_name === 'overall');
    expect(Number(overall?.event_count)).toBe(2);

    // Browser=Chrome should be 2
    const browser = metricRows.find(
      (r) => r.dimension_name === 'browser' && r.dimension_value === 'Chrome',
    );
    expect(Number(browser?.event_count)).toBe(2);

    // Path=/about should be 1 (only page_view has path)
    const pathRow = metricRows.find(
      (r) => r.dimension_name === 'path' && r.dimension_value === '/about',
    );
    expect(Number(pathRow?.event_count)).toBe(1);
  });

  it('backfill query populates analytics.property_metadata for custom props', async () => {
    const projectId = randomUUID();

    const event = makeEventMessage({
      project_id: projectId,
      event_name: 'purchase',
      props_str: { item_name: 'Widget' },
      props_num: { price: 19.99 },
      props_bool: { gift_wrapped: true },
    });

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(event) }],
    });

    await pollClickHouse(projectId, 1);

    // Property metadata is no longer populated by MVs — run the same
    // INSERT...SELECT queries that scheduler-analytics uses.
    await ch.command({
      query: `
        INSERT INTO analytics.property_metadata
        SELECT
            project_id, property_name, 'string' AS property_type,
            minState(first_seen) AS first_seen, maxState(last_seen) AS last_seen,
            sumState(event_count) AS event_count,
            uniqState(unique_values) AS unique_values,
            anyState(example_value) AS example_value,
            maxState(updated_at) AS updated_at
        FROM (
            SELECT project_id, key AS property_name,
                timestamp AS first_seen, timestamp AS last_seen,
                toUInt64(1) AS event_count,
                toString(props_str[key]) AS unique_values,
                toString(props_str[key]) AS example_value,
                timestamp AS updated_at
            FROM analytics.events
            ARRAY JOIN mapKeys(props_str) AS key
            WHERE project_id = {projectId:String}
        )
        GROUP BY project_id, property_name
      `,
      query_params: { projectId },
    });
    await ch.command({
      query: `
        INSERT INTO analytics.property_metadata
        SELECT
            project_id, property_name, 'number' AS property_type,
            minState(first_seen) AS first_seen, maxState(last_seen) AS last_seen,
            sumState(event_count) AS event_count,
            uniqState(unique_values) AS unique_values,
            anyState(example_value) AS example_value,
            maxState(updated_at) AS updated_at
        FROM (
            SELECT project_id, key AS property_name,
                timestamp AS first_seen, timestamp AS last_seen,
                toUInt64(1) AS event_count,
                toString(props_num[key]) AS unique_values,
                toString(props_num[key]) AS example_value,
                timestamp AS updated_at
            FROM analytics.events
            ARRAY JOIN mapKeys(props_num) AS key
            WHERE project_id = {projectId:String}
        )
        GROUP BY project_id, property_name
      `,
      query_params: { projectId },
    });
    await ch.command({
      query: `
        INSERT INTO analytics.property_metadata
        SELECT
            project_id, property_name, 'boolean' AS property_type,
            minState(first_seen) AS first_seen, maxState(last_seen) AS last_seen,
            sumState(event_count) AS event_count,
            uniqState(unique_values) AS unique_values,
            anyState(example_value) AS example_value,
            maxState(updated_at) AS updated_at
        FROM (
            SELECT project_id, key AS property_name,
                timestamp AS first_seen, timestamp AS last_seen,
                toUInt64(1) AS event_count,
                if(props_bool[key] = 1, 'true', 'false') AS unique_values,
                if(props_bool[key] = 1, 'true', 'false') AS example_value,
                timestamp AS updated_at
            FROM analytics.events
            ARRAY JOIN mapKeys(props_bool) AS key
            WHERE project_id = {projectId:String}
        )
        GROUP BY project_id, property_name
      `,
      query_params: { projectId },
    });

    const result = await ch.query({
      query: `
        SELECT
          property_name,
          property_type,
          sumMerge(event_count) AS event_count,
          anyMerge(example_value) AS example_value
        FROM analytics.property_metadata
        WHERE project_id = {projectId:String}
        GROUP BY property_name, property_type
        ORDER BY property_name
      `,
      query_params: { projectId },
      format: 'JSONEachRow',
    });
    const propRows = await result.json<Record<string, unknown>>();

    expect(propRows).toHaveLength(3);

    const strProp = propRows.find((r) => r.property_name === 'item_name');
    expect(strProp?.property_type).toBe('string');
    expect(strProp?.example_value).toBe('Widget');
    expect(Number(strProp?.event_count)).toBe(1);

    const numProp = propRows.find((r) => r.property_name === 'price');
    expect(numProp?.property_type).toBe('number');
    expect(Number(numProp?.event_count)).toBe(1);

    const boolProp = propRows.find((r) => r.property_name === 'gift_wrapped');
    expect(boolProp?.property_type).toBe('boolean');
    expect(Number(boolProp?.event_count)).toBe(1);
  });

  it('materialized view populates analytics.sessions with aggregated session data', async () => {
    const projectId = randomUUID();
    const sessionId = randomUUID();
    const userId = `user-${randomUUID().slice(0, 8)}`;

    const events = [
      makeEventMessage({
        project_id: projectId,
        session_id: sessionId,
        user_id: userId,
        event_name: 'page_view',
        browser: 'Firefox',
        os: 'Linux',
        device_type: 'desktop',
        country: 'BR',
        continent: 'SA',
        region: 'SP',
      }),
      makeEventMessage({
        project_id: projectId,
        session_id: sessionId,
        user_id: userId,
        event_name: 'page_view',
        browser: 'Firefox',
        os: 'Linux',
        device_type: 'desktop',
        country: 'BR',
      }),
      makeEventMessage({
        project_id: projectId,
        session_id: sessionId,
        user_id: userId,
        event_name: 'click',
        browser: 'Firefox',
        os: 'Linux',
        device_type: 'desktop',
        country: 'BR',
      }),
    ];

    await producer.send({
      topic: TOPIC,
      messages: events.map((e) => ({ value: JSON.stringify(e) })),
    });

    await pollClickHouse(projectId, 3);

    // Poll the sessions aggregate table
    const deadline = Date.now() + 15_000;
    let sessionRows: Record<string, unknown>[] = [];
    while (Date.now() < deadline) {
      const result = await ch.query({
        query: `
          SELECT
            s.session_id,
            m.user_id,
            s.started_at,
            s.ended_at,
            s.total_events,
            s.page_views,
            s.browser,
            s.os,
            s.device_type,
            s.country
          FROM (
            SELECT
              session_id,
              minMerge(started_at) AS started_at,
              maxMerge(ended_at) AS ended_at,
              sumMerge(total_events) AS total_events,
              sumMerge(page_views) AS page_views,
              anyMerge(browser) AS browser,
              anyMerge(os) AS os,
              anyMerge(device_type) AS device_type,
              anyMerge(country) AS country
            FROM analytics.sessions
            WHERE project_id = {projectId:String} AND session_id = {sessionId:String}
            GROUP BY session_id
          ) s
          LEFT JOIN (
            SELECT DISTINCT session_id, user_id
            FROM analytics.session_user_map
            WHERE project_id = {projectId:String} AND session_id = {sessionId:String}
          ) m ON s.session_id = m.session_id
        `,
        query_params: { projectId, sessionId },
        format: 'JSONEachRow',
      });
      sessionRows = await result.json<Record<string, unknown>>();
      if (sessionRows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(sessionRows).toHaveLength(1);
    const row = sessionRows[0];
    expect(row.session_id).toBe(sessionId);
    expect(row.user_id).toBe(userId);
    expect(Number(row.total_events)).toBe(3);
    expect(Number(row.page_views)).toBe(2);
    expect(row.browser).toBe('Firefox');
    expect(row.os).toBe('Linux');
    expect(row.device_type).toBe('desktop');
    expect(row.country).toBe('BR');
    expect(row.started_at).toBeDefined();
    expect(row.ended_at).toBeDefined();
  });

  it('sessions with empty session_id are excluded from analytics.sessions', async () => {
    const projectId = randomUUID();

    const event = makeEventMessage({
      project_id: projectId,
      session_id: '',
      event_name: 'page_view',
    });

    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(event) }],
    });

    await pollClickHouse(projectId, 1);

    // Give MV a moment to process, then check sessions is empty for this project
    await new Promise((r) => setTimeout(r, 2000));

    const result = await ch.query({
      query: `
        SELECT count() AS cnt
        FROM analytics.sessions
        WHERE project_id = {projectId:String}
      `,
      query_params: { projectId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ cnt: string }>();
    expect(Number(rows[0].cnt)).toBe(0);
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
