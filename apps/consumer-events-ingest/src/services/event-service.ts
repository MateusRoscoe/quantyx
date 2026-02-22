import { ClickHouseEvent } from '@quantyx/clickhouse';
import { EventMessage } from '@quantyx/shared';

export class EventService {
  static transformToClickHouseFormat(event: EventMessage): ClickHouseEvent {
    // Parse timestamp to ensure proper date extraction
    const timestampDate = new Date(event.timestamp);
    const year = timestampDate.getUTCFullYear();
    const month = String(timestampDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(timestampDate.getUTCDate()).padStart(2, '0');
    const validDate = `${year}-${month}-${day}`;

    return {
      event_id: event.event_id,
      project_id: event.project_id,
      user_id: event.user_id,
      session_id: event.session_id,
      event_name: event.event_name,
      timestamp: Math.floor(timestampDate.getTime() / 1000), // Convert to Unix timestamp (seconds)
      date: validDate,
      country: event.country || '',
      continent: event.continent || '',
      region: event.region || '',
      state: event.state || '',
      city: event.city || '',
      device_type: event.device_type || '',
      platform: event.platform || '',
      browser: event.browser || '',
      browser_version: event.browser_version || '',
      os: event.os || '',
      os_version: event.os_version || '',
      props_str: event.props_str || {},
      props_num: event.props_num || {},
      props_bool: event.props_bool
        ? Object.fromEntries(
            Object.entries(event.props_bool).map(([k, v]) => [k, v ? 1 : 0])
          )
        : {},
      ip_address: event.ip_address || '::',
      user_agent: event.user_agent || '',
    };
  }
}
