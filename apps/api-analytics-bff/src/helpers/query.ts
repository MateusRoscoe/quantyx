import { clickhouse } from '@quantyx/clickhouse';

export interface DateRangeParams {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface DimensionFilter {
  browser?: string;
  os?: string;
  country?: string;
  device_type?: string;
  event_name?: string;
  path?: string;
}

/**
 * Build WHERE clause fragments for dimension filters on the events table.
 */
export function buildEventFilters(filters: DimensionFilter): {
  clauses: string[];
  params: Record<string, string>;
} {
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  const entries = Object.entries(filters) as [string, string | undefined][];

  for (const [key, value] of entries) {
    if (!value) continue;
    const values = value.split(',');
    if (values.length === 1) {
      clauses.push(`${key} = {${key}:String}`);
      params[key] = values[0];
    } else {
      // For multi-value, use IN with array
      clauses.push(
        `${key} IN (${values.map((_, i) => `{${key}_${i}:String}`).join(', ')})`,
      );
      values.forEach((v, i) => {
        params[`${key}_${i}`] = v;
      });
    }
  }

  return { clauses, params };
}

/**
 * Build WHERE clause fragments for dimension filters on the metrics_daily table.
 */
export function buildMetricsFilters(filters: DimensionFilter): {
  clauses: string[];
  params: Record<string, string>;
} {
  // For metrics_daily, filters apply as additional conditions on dimension_value
  // We handle this differently per-endpoint, so this is a simple passthrough
  return buildEventFilters(filters);
}

/**
 * Execute a ClickHouse query and return typed results.
 */
export async function queryClickHouse<T>(
  query: string,
  params: Record<string, string | number>,
): Promise<T[]> {
  const result = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  return result.json<T>();
}
