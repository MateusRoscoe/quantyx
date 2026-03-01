import { QuantyxClient } from './client.js';

const TEST_CONFIG = {
  apiKey: 'qx_test-api-key-12345',
  endpoint: 'https://ingest.test.io',
  flushInterval: 60_000, // long interval so auto-flush doesn't interfere
  maxBatchSize: 5,
  autoDetect: false,
};

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchSpy);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('QuantyxClient', () => {
  it('track() queues events with auto-generated fields', () => {
    const client = new QuantyxClient(TEST_CONFIG);
    client.track('page_view', { props_str: { path: '/home' } });

    // No flush yet — queue has 1 event, batch size is 5
    expect(fetchSpy).not.toHaveBeenCalled();

    void client.shutdown();
  });

  it('flush() sends POST to /ingest-bulk with correct headers and body', async () => {
    const client = new QuantyxClient(TEST_CONFIG);
    client.track('click');

    await client.flush();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ingest.test.io/ingest-bulk');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['X-API-Key']).toBe('qx_test-api-key-12345');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body as string) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      event_name: 'click',
      user_id: '',
    });
    // autoDetect is off, so no platform field
    expect(body[0]['platform']).toBeUndefined();
    expect(body[0]['event_id']).toBeDefined();
    expect(body[0]['session_id']).toBeDefined();
    expect(body[0]['timestamp']).toBeDefined();

    await client.shutdown();
  });

  it('auto-flushes when maxBatchSize is reached', async () => {
    const client = new QuantyxClient(TEST_CONFIG);

    for (let i = 0; i < 5; i++) {
      client.track(`event_${i}`);
    }

    // flush is called via void (fire-and-forget), so let microtasks settle
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as unknown[];
    expect(body).toHaveLength(5);

    await client.shutdown();
  });

  it('auto-flushes on interval', async () => {
    const client = new QuantyxClient({ ...TEST_CONFIG, flushInterval: 1_000 });
    client.track('tick');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchSpy).toHaveBeenCalledOnce();

    await client.shutdown();
  });

  it('identify() sets user_id on subsequent events', async () => {
    const client = new QuantyxClient(TEST_CONFIG);
    client.identify('user-42');
    client.track('action');

    await client.flush();

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Array<Record<string, unknown>>;
    expect(body[0]['user_id']).toBe('user-42');

    await client.shutdown();
  });

  it('shutdown() flushes remaining queue and clears timer', async () => {
    const client = new QuantyxClient(TEST_CONFIG);
    client.track('final_event');

    await client.shutdown();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Array<Record<string, unknown>>;
    expect(body[0]['event_name']).toBe('final_event');
  });

  it('handles fetch errors gracefully', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const client = new QuantyxClient(TEST_CONFIG);
    client.track('oops');

    // Should not throw
    await expect(client.flush()).resolves.toBeUndefined();

    await client.shutdown();
  });

  it('visibilitychange triggers flush via sendBeacon', async () => {
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy });

    const client = new QuantyxClient(TEST_CONFIG);
    client.track('bg_event');

    // Simulate visibility change to hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sendBeaconSpy).toHaveBeenCalledOnce();
    const [url] = sendBeaconSpy.mock.calls[0] as [string, Blob];
    expect(url).toContain('/ingest-bulk');

    // Restore
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    await client.shutdown();
  });
});
