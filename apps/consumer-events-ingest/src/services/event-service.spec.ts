import { EventMessage } from '@quantyx/shared';
import { EventService } from './event-service';

function makeEvent(overrides: Partial<EventMessage> = {}): EventMessage {
  return {
    event_id: '019712a0-1234-7000-8000-000000000001',
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 'user-123',
    session_id: '550e8400-e29b-41d4-a716-446655440001',
    event_name: 'page_view',
    timestamp: '2025-06-15T14:30:00.000Z',
    ip_address: '192.168.1.1',
    ...overrides,
  };
}

describe('EventService', () => {
  describe('transformToClickHouseFormat', () => {
    it('transforms a fully-populated event', () => {
      const event = makeEvent({
        country: 'US',
        continent: 'North America',
        region: 'Northern America',
        state: 'California',
        city: 'San Francisco',
        device_type: 'desktop',
        platform: 'web',
        browser: 'Chrome',
        browser_version: '125.0',
        os: 'macOS',
        os_version: '15.1',
        user_agent: 'Mozilla/5.0',
        props_str: { page: '/home' },
        props_num: { load_time: 1.5 },
        props_bool: { logged_in: true, is_admin: false },
      });

      const result = EventService.transformToClickHouseFormat(event);

      expect(result).toEqual({
        event_id: '019712a0-1234-7000-8000-000000000001',
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'user-123',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        event_name: 'page_view',
        timestamp: Math.floor(new Date('2025-06-15T14:30:00.000Z').getTime() / 1000),
        date: '2025-06-15',
        country: 'US',
        continent: 'North America',
        region: 'Northern America',
        state: 'California',
        city: 'San Francisco',
        device_type: 'desktop',
        platform: 'web',
        browser: 'Chrome',
        browser_version: '125.0',
        os: 'macOS',
        os_version: '15.1',
        props_str: { page: '/home' },
        props_num: { load_time: 1.5 },
        props_bool: { logged_in: 1, is_admin: 0 },
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });
    });

    it('coalesces missing optional strings to empty string', () => {
      const result = EventService.transformToClickHouseFormat(makeEvent());

      expect(result.country).toBe('');
      expect(result.continent).toBe('');
      expect(result.region).toBe('');
      expect(result.state).toBe('');
      expect(result.city).toBe('');
      expect(result.device_type).toBe('');
      expect(result.platform).toBe('');
      expect(result.browser).toBe('');
      expect(result.browser_version).toBe('');
      expect(result.os).toBe('');
      expect(result.os_version).toBe('');
      expect(result.user_agent).toBe('');
    });

    it('defaults missing ip_address to "::"', () => {
      const event = makeEvent({ ip_address: undefined } as Partial<EventMessage>);

      const result = EventService.transformToClickHouseFormat(event);

      expect(result.ip_address).toBe('::');
    });

    it('defaults missing props_str/props_num/props_bool to empty objects', () => {
      const result = EventService.transformToClickHouseFormat(makeEvent());

      expect(result.props_str).toEqual({});
      expect(result.props_num).toEqual({});
      expect(result.props_bool).toEqual({});
    });

    it('converts props_bool true to 1 and false to 0', () => {
      const event = makeEvent({ props_bool: { active: true, deleted: false } });

      const result = EventService.transformToClickHouseFormat(event);

      expect(result.props_bool).toEqual({ active: 1, deleted: 0 });
    });

    it('handles mixed props_bool values', () => {
      const event = makeEvent({
        props_bool: { a: true, b: false, c: true, d: false },
      });

      const result = EventService.transformToClickHouseFormat(event);

      expect(result.props_bool).toEqual({ a: 1, b: 0, c: 1, d: 0 });
    });

    it('extracts correct date across month/year boundaries', () => {
      const nye = makeEvent({ timestamp: '2024-12-31T23:59:59.000Z' });
      const newYear = makeEvent({ timestamp: '2025-01-01T00:00:00.000Z' });

      expect(EventService.transformToClickHouseFormat(nye).date).toBe('2024-12-31');
      expect(EventService.transformToClickHouseFormat(newYear).date).toBe('2025-01-01');
    });

    it('converts timestamp to Unix seconds (not milliseconds)', () => {
      const event = makeEvent({ timestamp: '2025-06-15T14:30:00.000Z' });

      const result = EventService.transformToClickHouseFormat(event);
      const expectedMs = new Date('2025-06-15T14:30:00.000Z').getTime();

      expect(result.timestamp).toBe(Math.floor(expectedMs / 1000));
      expect(result.timestamp).toBeLessThan(expectedMs); // seconds < milliseconds
    });

    it('pads single-digit month and day with leading zero', () => {
      const event = makeEvent({ timestamp: '2024-03-05T10:00:00.000Z' });

      const result = EventService.transformToClickHouseFormat(event);

      expect(result.date).toBe('2024-03-05');
    });

    it('passes through core identifiers unchanged', () => {
      const event = makeEvent({
        event_id: 'evt-abc',
        project_id: 'proj-xyz',
        user_id: 'usr-456',
        session_id: 'sess-789',
        event_name: 'click',
      });

      const result = EventService.transformToClickHouseFormat(event);

      expect(result.event_id).toBe('evt-abc');
      expect(result.project_id).toBe('proj-xyz');
      expect(result.user_id).toBe('usr-456');
      expect(result.session_id).toBe('sess-789');
      expect(result.event_name).toBe('click');
    });
  });
});
