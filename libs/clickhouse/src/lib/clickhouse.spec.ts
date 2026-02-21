jest.mock('./env', () => ({
  environment: {
    CLICKHOUSE_URL: 'http://localhost:8123',
    CLICKHOUSE_USER: 'default',
    CLICKHOUSE_PASSWORD: '',
    CLICKHOUSE_DATABASE: 'analytics',
    CLICKHOUSE_REQUEST_TIMEOUT_MS: 30000,
  },
}));

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => ({
    ping: jest.fn(),
  })),
}));

import { createClient } from '@clickhouse/client';
import { clickhouse, clickhouseHealthCheck } from './clickhouse';

const mockPing = clickhouse.ping as jest.Mock;

describe('clickhouse', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createClient', () => {
    it('should create client with environment config', () => {
      expect(createClient).toHaveBeenCalledWith({
        url: 'http://localhost:8123',
        username: 'default',
        password: '',
        database: 'analytics',
        request_timeout: 30000,
        compression: {
          request: true,
          response: true,
        },
      });
    });

    it('should export the client instance', () => {
      expect(clickhouse).toBeDefined();
      expect(typeof clickhouse.ping).toBe('function');
    });
  });

  describe('clickhouseHealthCheck', () => {
    it('should return success when ping succeeds', async () => {
      mockPing.mockResolvedValue({ success: true });

      const result = await clickhouseHealthCheck();

      expect(result).toEqual({ success: true });
      expect(mockPing).toHaveBeenCalledTimes(1);
    });

    it('should return failure when ping fails', async () => {
      const error = new Error('Connection refused');
      mockPing.mockResolvedValue({ success: false, error });

      const result = await clickhouseHealthCheck();

      expect(result).toEqual({ success: false, error });
    });

    it('should catch thrown errors and return failure', async () => {
      const error = new Error('Network error');
      mockPing.mockRejectedValue(error);

      const result = await clickhouseHealthCheck();

      expect(result).toEqual({ success: false, error });
    });

    it('should wrap non-Error thrown values in an Error', async () => {
      mockPing.mockRejectedValue('string error');

      const result = await clickhouseHealthCheck();

      expect(result).toEqual({
        success: false,
        error: new Error('string error'),
      });
    });
  });
});
