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
  user_id?: string;
  session_id?: string;
}

export interface PropertyFilter {
  type: 'str' | 'num' | 'bool';
  name: string;
  value: string;
}

/**
 * Parse custom property filter query params (prop_str.*, prop_num.*, prop_bool.*).
 */
export function parsePropertyFilters(
  query: Record<string, string>,
): PropertyFilter[] {
  const filters: PropertyFilter[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (!value) continue;
    const match = key.match(/^prop_(str|num|bool)\.(.+)$/);
    if (match) {
      filters.push({
        type: match[1] as 'str' | 'num' | 'bool',
        name: match[2],
        value,
      });
    }
  }
  return filters;
}

/**
 * Build WHERE clause fragments for custom property filters on the events table.
 */
export function buildPropertyFilterClauses(filters: PropertyFilter[]): {
  clauses: string[];
  params: Record<string, string | number>;
} {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    const paramKey = `prop_${f.type}_${i}`;
    const nameKey = `prop_name_${i}`;
    params[nameKey] = f.name;

    switch (f.type) {
      case 'str':
        clauses.push(`props_str[{${nameKey}:String}] = {${paramKey}:String}`);
        params[paramKey] = f.value;
        break;
      case 'num':
        clauses.push(`props_num[{${nameKey}:String}] = {${paramKey}:Float64}`);
        params[paramKey] = Number(f.value);
        break;
      case 'bool':
        clauses.push(`props_bool[{${nameKey}:String}] = {${paramKey}:UInt8}`);
        params[paramKey] = f.value === 'true' ? 1 : 0;
        break;
    }
  }

  return { clauses, params };
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
