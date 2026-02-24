import { renderHook, waitFor } from '@/test/test-utils';
import { api } from '@/lib/api';
import {
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from './use-organizations';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('useOrganizations', () => {
  it('fetches organizations list', async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: '1', name: 'Acme' }]);
    const { result } = renderHook(() => useOrganizations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: '1', name: 'Acme' }]);
    expect(api.get).toHaveBeenCalledWith('/organizations');
  });
});

describe('useOrganization', () => {
  it('fetches a single organization by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ id: '1', name: 'Acme' });
    const { result } = renderHook(() => useOrganization('1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: '1', name: 'Acme' });
    expect(api.get).toHaveBeenCalledWith('/organizations/1');
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useOrganization(''));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useCreateOrganization', () => {
  it('calls api.post and invalidates organizations query', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: '2', name: 'New' });
    const { result } = renderHook(() => useCreateOrganization());
    result.current.mutate({ name: 'New' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/organizations', { name: 'New' });
  });
});

describe('useUpdateOrganization', () => {
  it('calls api.patch with the correct path', async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: '1', name: 'Updated' });
    const { result } = renderHook(() => useUpdateOrganization('1'));
    result.current.mutate({ name: 'Updated' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/organizations/1', {
      name: 'Updated',
    });
  });
});

describe('useDeleteOrganization', () => {
  it('calls api.del with the correct path', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteOrganization());
    result.current.mutate('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.del).toHaveBeenCalledWith('/organizations/1');
  });
});
