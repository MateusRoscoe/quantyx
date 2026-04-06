import { clickhouse } from '@quantyx/clickhouse';
import { getLogger } from '@quantyx/shared-backend';

const logger = getLogger('property-metadata');

async function getEarliestEventTime(): Promise<Date | null> {
  const result = await clickhouse.query({
    query: `SELECT min(timestamp) AS earliest FROM analytics.events`,
    format: 'JSONEachRow',
  });
  const rows = await result.json<{ earliest: string }>();
  if (rows.length === 0 || !rows[0].earliest || rows[0].earliest === '1970-01-01 00:00:00') return null;
  return new Date(rows[0].earliest);
}

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

async function updateWatermark(hour: Date): Promise<void> {
  // ClickHouse DateTime doesn't support milliseconds in JSONEachRow —
  // format as 'YYYY-MM-DD HH:MM:SS'
  const formatted = hour.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  await clickhouse.insert({
    table: 'analytics.property_metadata_watermark',
    format: 'JSONEachRow',
    values: [{ job_name: 'property_backfill', last_processed_hour: formatted }],
  });
}

async function backfillPropertyType(
  from: string,
  to: string,
  propColumn: 'props_str' | 'props_num' | 'props_bool',
  propertyType: string,
  valueExpr: string,
): Promise<void> {
  const start = performance.now();
  const result = await clickhouse.command({
    query: `
      INSERT INTO analytics.property_metadata
      SELECT
          project_id,
          property_name,
          '${propertyType}' AS property_type,
          minState(first_seen) AS first_seen,
          maxState(last_seen) AS last_seen,
          sumState(event_count) AS event_count,
          uniqState(unique_values) AS unique_values,
          anyState(example_value) AS example_value,
          maxState(updated_at) AS updated_at
      FROM (
          SELECT
              project_id,
              key AS property_name,
              timestamp AS first_seen,
              timestamp AS last_seen,
              toUInt64(1) AS event_count,
              ${valueExpr} AS unique_values,
              ${valueExpr} AS example_value,
              timestamp AS updated_at
          FROM analytics.events
          ARRAY JOIN mapKeys(${propColumn}) AS key
          WHERE timestamp >= parseDateTimeBestEffort({from:String})
            AND timestamp < parseDateTimeBestEffort({to:String})
      )
      GROUP BY project_id, property_name
    `,
    query_params: { from, to },
  });
  const elapsedMs = Math.round(performance.now() - start);
  const writtenRows = result.summary?.written_rows ?? '0';
  logger.info(
    { propertyType, writtenRows, elapsedMs },
    `Backfilled ${propertyType} properties`,
  );
}

const CHUNK_MS = 6 * 60 * 60 * 1000; // 6 hours per chunk

export async function backfillPropertyMetadata(signal?: AbortSignal): Promise<void> {
  const watermark = await getWatermark();

  // Process up to the last fully completed hour
  const now = new Date();
  const lastCompleteHour = new Date(now);
  lastCompleteHour.setMinutes(0, 0, 0);

  // If no watermark, start from the earliest event in ClickHouse
  let from: Date;
  if (watermark) {
    from = watermark;
  } else {
    const earliest = await getEarliestEventTime();
    from = earliest ?? new Date(lastCompleteHour.getTime() - 24 * 60 * 60 * 1000);
  }

  if (from >= lastCompleteHour) {
    logger.info('No complete hours to process, skipping');
    return;
  }

  const totalHours = Math.round((lastCompleteHour.getTime() - from.getTime()) / (60 * 60 * 1000));
  const totalChunks = Math.ceil((lastCompleteHour.getTime() - from.getTime()) / CHUNK_MS);
  logger.info(
    { from: from.toISOString(), to: lastCompleteHour.toISOString(), totalHours, totalChunks, watermark: watermark?.toISOString() ?? null },
    'Starting property metadata backfill',
  );

  // Process in chunks, advancing watermark after each so crashes don't lose progress.
  // Shutdown signal is checked between chunks — the current chunk always runs to
  // completion (all 3 property types + watermark) to avoid double-counting on restart.
  let cursor = from;
  let chunkIndex = 0;
  while (cursor < lastCompleteHour) {
    if (signal?.aborted) {
      logger.info({ chunk: `${chunkIndex}/${totalChunks}`, watermark: cursor.toISOString() }, 'Shutdown requested, stopping between chunks');
      return;
    }

    chunkIndex++;
    const chunkEnd = new Date(Math.min(cursor.getTime() + CHUNK_MS, lastCompleteHour.getTime()));
    const fromStr = cursor.toISOString();
    const toStr = chunkEnd.toISOString();

    logger.info({ chunk: `${chunkIndex}/${totalChunks}`, from: fromStr, to: toStr }, 'Processing chunk');

    await backfillPropertyType(fromStr, toStr, 'props_str', 'string', "toString(props_str[key])");
    await backfillPropertyType(fromStr, toStr, 'props_num', 'number', "toString(props_num[key])");
    await backfillPropertyType(fromStr, toStr, 'props_bool', 'boolean', "if(props_bool[key] = 1, 'true', 'false')");

    await updateWatermark(chunkEnd);
    logger.info({ chunk: `${chunkIndex}/${totalChunks}`, watermark: toStr }, 'Chunk complete, watermark advanced');
    cursor = chunkEnd;
  }

  logger.info({ totalChunks }, 'Property metadata backfill complete');
}
