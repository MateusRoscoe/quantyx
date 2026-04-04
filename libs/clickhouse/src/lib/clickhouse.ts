import { createClient } from '@clickhouse/client';
import { environment } from './env';

export const clickhouse = createClient({
  url: environment.CLICKHOUSE_URL,
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
  device_type: string;
  platform: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  // Custom properties (flexible schema)
  props_str: Record<string, string>;
  props_num: Record<string, number>;
  props_bool: Record<string, number>; // UInt8 in ClickHouse (0 or 1)
  // Metadata
  ip_address: string; // IPv4 or IPv6 string
  user_agent: string;
};
