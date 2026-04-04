import { clickhouse, ClickHouseEvent } from '@quantyx/clickhouse';
import { getLogger } from '@quantyx/shared-backend';

const logger = getLogger('clickhouse-insert');

export async function insertEventsToClickHouse(
  events: ClickHouseEvent[],
): Promise<void> {
  try {
    const result = await clickhouse.insert({
      table: 'analytics.events',
      format: 'JSONEachRow',
      values: events,
    });

    if (!result.executed) {
      logger.warn('Insert was not executed (no data to insert)');
    }
  } catch (error) {
    logger.error(error, 'Failed to insert events to ClickHouse');
    throw error;
  }
}
