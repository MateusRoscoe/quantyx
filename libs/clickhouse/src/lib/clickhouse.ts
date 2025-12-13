import { createClient } from '@clickhouse/client';
import { environment } from './env';
import { success } from 'zod';

export const clickhouse = createClient({
  host: environment.CLICKHOUSE_HOST,
  username: environment.CLICKHOUSE_USER,
  password: environment.CLICKHOUSE_PASSWORD,
  database: environment.CLICKHOUSE_DATABASE,
  request_timeout: environment.CLICKHOUSE_REQUEST_TIMEOUT_MS,
  compression: {
    request: true,
    response: true,
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
