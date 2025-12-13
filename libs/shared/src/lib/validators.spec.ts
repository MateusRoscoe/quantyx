/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventMessage, EventMessageInput } from './validators';

const basePayload = {
  event_id: '018ea8e1-b5be-7462-aa55-5f9d0d10c9c8',
  tenant_id: 'c0a80101-7e6c-48a3-9f25-0e6f5c0d4a1b',
  session_id: '7aa36cf5-1f5f-4f9a-9ee8-4c0c8b8c5f75',
  user_id: 'user-123',
  event_name: 'button_click',
  timestamp: '2024-05-01T12:00:00.123Z',
};

describe('Validators', () => {
  describe('EventMessageInput', () => {
    it('accepts a minimal valid payload', () => {
      const result = EventMessageInput.safeParse(basePayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.event_id).toBe(basePayload.event_id);
      }
    });

    it('allows optional fields and custom props', () => {
      const payload = {
        ...basePayload,
        date: '2024-05-01',
        country: 'USA',
        region: 'CA',
        city: 'San Francisco',
        device_type: 'desktop',
        platform: 'web',
        browser: 'Chrome',
        browser_version: '125.0.0',
        os: 'macOS',
        os_version: '14.2',
        props_str: { color: 'blue' },
        props_num: { count: 3 },
        props_bool: { subscribed: true },
      };

      const result = EventMessageInput.safeParse(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.props_str?.color).toBe('blue');
        expect(result.data.props_num?.count).toBe(3);
        expect(result.data.props_bool?.subscribed).toBe(true);
      }
    });

    it('rejects when required identifiers are missing', () => {
      const { event_id, ...rest } = basePayload;

      const result = EventMessageInput.safeParse(rest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes('event_id'))
        ).toBe(true);
      }
    });

    it('rejects invalid UUID versions', () => {
      const result = EventMessageInput.safeParse({
        ...basePayload,
        event_id: 'not-a-uuid',
        tenant_id: '1234',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toEqual(
          expect.arrayContaining(['event_id', 'tenant_id'])
        );
      }
    });

    it('requires ISO timestamps with millisecond precision', () => {
      const result = EventMessageInput.safeParse({
        ...basePayload,
        timestamp: '2024-05-01T12:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join('.') === 'timestamp')
        ).toBe(true);
      }
    });

    it('validates yyyy-mm-dd date format when provided', () => {
      const result = EventMessageInput.safeParse({
        ...basePayload,
        date: '05/01/2024',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'date')).toBe(
          true
        );
      }
    });

    it('rejects invalid values in props', () => {
      const result = EventMessageInput.safeParse({
        ...basePayload,
        props_str: { aaaa: 1 },
        props_num: { count: 'three' },
        props_bool: { subscribed: 'yes' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toEqual(
          expect.arrayContaining([
            'props_str.aaaa',
            'props_num.count',
            'props_bool.subscribed',
          ])
        );
      }
    });

    it('converts keys in props to string', () => {
      const result = EventMessageInput.safeParse({
        ...basePayload,
        props_str: { 1: 'a' },
        props_num: { 2: 1 },
        props_bool: { 3: true },
      });

      console.log(result);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Parsing failed unexpectedly');
      expect(result.data.props_str?.['1']).toBe('a');
      expect(result.data.props_num?.['2']).toBe(1);
      expect(result.data.props_bool?.['3']).toBe(true);
    });
  });

  describe('EventMessage', () => {
    it('rejects invalid IP addresses', () => {
      const result = EventMessage.safeParse({
        ...basePayload,
        ip_address: '999.999.999.999',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path[0] === 'ip_address')
        ).toBe(true);
      }
    });
    it('rejects missing ip_address', () => {
      const result = EventMessage.safeParse({
        ...basePayload,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path[0] === 'ip_address')
        ).toBe(true);
      }
    });

    it('accepts valid IPv4 and IPv6 addresses', () => {
      const ipv4Result = EventMessage.safeParse({
        ...basePayload,
        ip_address: '192.168.1.1',
      });
      expect(ipv4Result.success).toBe(true);

      const ipv6Result = EventMessage.safeParse({
        ...basePayload,
        ip_address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });
      expect(ipv6Result.success).toBe(true);
    });
    it('accepts optional user_agent', () => {
      const result = EventMessage.safeParse({
        ...basePayload,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_agent).toBe('Mozilla/5.0');
      }
    });
  });
});
