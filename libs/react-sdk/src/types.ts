export interface QuantyxConfig {
  /** API key for the X-API-Key header */
  apiKey: string;
  /** Ingest API endpoint, e.g. 'https://ingest.quantyx.io' */
  endpoint: string;
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Max events per batch (default: 20) */
  maxBatchSize?: number;
  /** Auto-detect browser/device info (default: true) */
  autoDetect?: boolean;
}

export interface EventProperties {
  country?: string;
  state?: string;
  city?: string;
  device_type?: string;
  platform?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, boolean>;
}

export interface UserTraits {
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, boolean>;
}

export interface GroupTraits {
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, boolean>;
}

export interface EventPayload {
  event_id: string;
  session_id: string;
  user_id: string;
  event_name: string;
  timestamp: string;
  country?: string;
  state?: string;
  city?: string;
  device_type?: string;
  platform?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, boolean>;
}

export interface DeviceContext {
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  device_type?: string;
  platform: 'web';
}
