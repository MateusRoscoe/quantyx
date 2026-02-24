import { api, ApiError } from './api';

const BASE_URL = 'http://localhost:3001';

function mockFetch(
  body: unknown,
  init: { status?: number; ok?: boolean } = {},
) {
  const { status = 200, ok = true } = init;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: 'Error',
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api.get', () => {
  it('calls fetch with GET and credentials: include', async () => {
    mockFetch({ id: '1' });
    const result = await api.get('/organizations');
    expect(result).toEqual({ id: '1' });
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/organizations`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('api.post', () => {
  it('sends JSON body with POST method', async () => {
    mockFetch({ id: '1' });
    await api.post('/organizations', { name: 'Acme' });
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    });
  });

  it('sends undefined body when no body provided', async () => {
    mockFetch({ id: '1' });
    await api.post('/organizations');
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    });
  });
});

describe('api.patch', () => {
  it('sends JSON body with PATCH method', async () => {
    mockFetch({ id: '1' });
    await api.patch('/organizations/1', { name: 'Updated' });
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/organizations/1`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
  });
});

describe('api.del', () => {
  it('sends DELETE method', async () => {
    mockFetch(undefined, { status: 204 });
    await api.del('/organizations/1');
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/organizations/1`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('204 handling', () => {
  it('returns undefined for 204 responses', async () => {
    mockFetch(undefined, { status: 204 });
    const result = await api.get('/something');
    expect(result).toBeUndefined();
  });
});

describe('error handling', () => {
  it('throws ApiError with status and message from body', async () => {
    mockFetch({ message: 'Not Found' }, { status: 404, ok: false });
    await expect(api.get('/missing')).rejects.toThrow(ApiError);
    await expect(api.get('/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Not Found',
    });
  });

  it('falls back to statusText when body.message is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
      }),
    );
    await expect(api.get('/fail')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    });
  });

  it('ApiError has correct name', async () => {
    mockFetch({ message: 'Bad Request' }, { status: 400, ok: false });
    try {
      await api.get('/bad');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).name).toBe('ApiError');
    }
  });
});
