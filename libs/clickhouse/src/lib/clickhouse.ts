import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { environment } from './env';

const rawClient = createClient({
  url: environment.CLICKHOUSE_URL,
  username: environment.CLICKHOUSE_USER,
  password: environment.CLICKHOUSE_PASSWORD,
  database: environment.CLICKHOUSE_DATABASE,
  request_timeout: environment.CLICKHOUSE_REQUEST_TIMEOUT_MS,
  compression: {
    request: true,
    response: true,
  },
  clickhouse_settings: {
    async_insert: environment.CLICKHOUSE_ASYNC_INSERT ? 1 : 0,
    wait_for_async_insert: environment.CLICKHOUSE_WAIT_FOR_ASYNC_INSERT ? 1 : 0,
    async_insert_deduplicate: environment.CLICKHOUSE_ASYNC_INSERT_DEDUPLICATE
      ? 1
      : 0,
  },
});

const chTracer = trace.getTracer('@quantyx/clickhouse');
const queryNameStore = new AsyncLocalStorage<string>();

/**
 * Execute a function with a query name that will be attached to ClickHouse
 * spans as `db.query.name`. Use this to give semantic names to queries
 * for observability (e.g., "overview-kpis", "events-feed").
 */
export function withQueryName<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return queryNameStore.run(name, fn);
}

function traceMethod<TArgs extends unknown[], TReturn>(
  operation: string,
  extractStatement: (...args: TArgs) => string,
  fn: (...args: TArgs) => TReturn,
  extractCollection?: (...args: TArgs) => string | undefined,
): (...args: TArgs) => TReturn {
  return (...args: TArgs) => {
    const statement = extractStatement(...args);
    const attributes: Record<string, string> = {
      'db.system': 'clickhouse',
      'db.operation.name': operation,
      'db.statement': statement.slice(0, 1024),
      'server.address': environment.CLICKHOUSE_URL,
    };

    const queryName = queryNameStore.getStore();
    if (queryName) {
      attributes['db.query.name'] = queryName;
    }

    const collection = extractCollection?.(...args);
    if (collection) {
      attributes['db.collection.name'] = collection;
    }

    return chTracer.startActiveSpan(
      `clickhouse.${operation}`,
      {
        kind: SpanKind.CLIENT,
        attributes,
      },
      (span) => {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result
            .then((val) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return val;
            })
            .catch((err) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(err),
              });
              span.recordException(err as Error);
              span.end();
              throw err;
            }) as TReturn;
        }
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      },
    ) as TReturn;
  };
}

export const clickhouse: ClickHouseClient = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'query') {
      return traceMethod(
        'query',
        (params: { query?: string }) => params?.query ?? '',
        target.query.bind(target),
      );
    }
    if (prop === 'insert') {
      return traceMethod(
        'insert',
        (params: { table?: string }) => `INSERT INTO ${params?.table ?? '?'}`,
        target.insert.bind(target),
        (params: { table?: string }) =>
          params?.table?.replace(/^analytics\./, ''),
      );
    }
    if (prop === 'command') {
      return traceMethod(
        'command',
        (params: { query?: string }) => params?.query ?? '',
        target.command.bind(target),
      );
    }
    if (prop === 'exec') {
      return traceMethod(
        'exec',
        (params: { query?: string }) => params?.query ?? '',
        target.exec.bind(target),
      );
    }
    return Reflect.get(target, prop, receiver);
  },
});

type ConnPingResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: Error;
    };

export async function clickhouseHealthCheck(): Promise<ConnPingResult> {
  try {
    const result = await clickhouse.ping();
    return result;
  } catch (error) {
    console.error('ClickHouse health check failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export type ClickHouseEvent = {
  event_id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  event_name: string;
  timestamp: number; // Unix timestamp in seconds
  // Standard dimensions
  country: string;
  continent: string;
  region: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  device_type: string;
  platform: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  path: string;
  // Custom properties (flexible schema)
  props_str: Record<string, string>;
  props_num: Record<string, number>;
  props_bool: Record<string, number>; // UInt8 in ClickHouse (0 or 1)
  // Metadata
  ip_address: string; // IPv4 or IPv6 string
  user_agent: string;
};
