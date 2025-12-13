import { clickhouse, ClickHouseEvent } from '@quantyx/clickhouse';

export async function insertEventsToClickHouse(
  events: ClickHouseEvent[]
): Promise<void> {
  try {
    const result = await clickhouse.insert({
      table: 'analytics.events',
      format: 'JSONEachRow',
      values: events,
    });

    if (!result.executed) {
      console.warn('Insert was not executed (no data to insert)');
    }
  } catch (error) {
    console.error('Failed to insert events to ClickHouse:', error);
    throw error;
  }
}
