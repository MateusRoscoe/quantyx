import { renderHook, waitFor } from '@/test/test-utils';
import { api } from '@/lib/api';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from './use-api-keys';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('useApiKeys', () => {
  it('fetches api keys for a project', async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: 'k1', name: 'key' }]);
    const { result } = renderHook(() => useApiKeys('p1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'k1', name: 'key' }]);
    expect(api.get).toHaveBeenCalledWith('/projects/p1/api-keys');
  });

  it('does not fetch when projectId is empty', () => {
    const { result } = renderHook(() => useApiKeys(''));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useCreateApiKey', () => {
  it('calls api.post with the correct path', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'k2', key: 'qx_abc' });
    const { result } = renderHook(() => useCreateApiKey('p1'));
    result.current.mutate({ name: 'new-key' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/projects/p1/api-keys', {
      name: 'new-key',
    });
  });
});

describe('useDeleteApiKey', () => {
  it('calls api.del with the correct path', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteApiKey('p1'));
    result.current.mutate('k1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.del).toHaveBeenCalledWith('/api-keys/k1');
  });
});
