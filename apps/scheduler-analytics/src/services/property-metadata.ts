import { clickhouse } from '@quantyx/clickhouse';
import { getLogger } from '@quantyx/shared-backend';

const logger = getLogger('property-metadata');

async function getWatermark(): Promise<Date | null> {
  const result = await clickhouse.query({
    query: `
      SELECT last_processed_hour
      FROM analytics.property_metadata_watermark FINAL
      WHERE job_name = 'property_backfill'
      LIMIT 1
    `,
    format: 'JSONEachRow',
  });

  const rows = await result.json<{ last_processed_hour: string }>();
  if (rows.length === 0) return null;
  return new Date(rows[0].last_processed_hour);
}

async function updateWatermark(hour: string): Promise<void> {
  await clickhouse.insert({
    table: 'analytics.property_metadata_watermark',
    format: 'JSONEachRow',
    values: [{ job_name: 'property_backfill', last_processed_hour: hour }],
  });
}

async function backfillPropertyType(
  from: string,
  to: string,
  propColumn: 'props_str' | 'props_num' | 'props_bool',
  propertyType: string,
  valueExpr: string,
): Promise<void> {
  await clickhouse.command({
    query: `
      INSERT INTO analytics.property_metadata
      SELECT
          project_id,
          key AS property_name,
          '${propertyType}' AS property_type,
          minState(timestamp) AS first_seen,
          maxState(timestamp) AS last_seen,
          sumState(toUInt64(1)) AS event_count,
          uniqState(${valueExpr}) AS unique_values,
          anyState(${valueExpr}) AS example_value,
          maxState(timestamp) AS updated_at
      FROM analytics.events
      WHERE timestamp >= parseDateTimeBestEffort({from:String})
        AND timestamp < parseDateTimeBestEffort({to:String})
      ARRAY JOIN mapKeys(${propColumn}) AS key
      GROUP BY project_id, key
    `,
    query_params: { from, to },
  });
}

export async function backfillPropertyMetadata(): Promise<void> {
  const watermark = await getWatermark();

  // Default to 24 hours ago if no watermark exists
  const from = watermark
    ? watermark.toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Process up to the last fully completed hour
  const now = new Date();
  const lastCompleteHour = new Date(now);
  lastCompleteHour.setMinutes(0, 0, 0);
  const to = lastCompleteHour.toISOString();

  if (new Date(from) >= lastCompleteHour) {
    logger.info('No complete hours to process, skipping');
    return;
  }

  logger.info({ from, to }, 'Backfilling property metadata');

  await backfillPropertyType(
    from,
    to,
    'props_str',
    'string',
    "toString(props_str[key])",
  );

  await backfillPropertyType(
    from,
    to,
    'props_num',
    'number',
    "toString(props_num[key])",
  );

  await backfillPropertyType(
    from,
    to,
    'props_bool',
    'boolean',
    "if(props_bool[key] = 1, 'true', 'false')",
  );

  await updateWatermark(to);

  logger.info({ from, to }, 'Property metadata backfill complete');
}
