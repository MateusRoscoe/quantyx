import { renderHook, waitFor } from '@/test/test-utils';
import { api } from '@/lib/api';
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from './use-projects';

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

describe('useProjects', () => {
  it('fetches projects for an organization', async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: 'p1', name: 'Proj' }]);
    const { result } = renderHook(() => useProjects('org1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'p1', name: 'Proj' }]);
    expect(api.get).toHaveBeenCalledWith('/organizations/org1/projects');
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHook(() => useProjects(''));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useProject', () => {
  it('fetches a single project by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 'p1', name: 'Proj' });
    const { result } = renderHook(() => useProject('p1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/projects/p1');
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useProject(''));
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateProject', () => {
  it('calls api.post with org-scoped path', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'p2', name: 'New' });
    const { result } = renderHook(() => useCreateProject('org1'));
    result.current.mutate({ name: 'New' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/organizations/org1/projects', {
      name: 'New',
    });
  });
});

describe('useUpdateProject', () => {
  it('calls api.patch with the correct path', async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: 'p1', name: 'Updated' });
    const { result } = renderHook(() => useUpdateProject());
    result.current.mutate({ id: 'p1', body: { name: 'Updated' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/projects/p1', {
      name: 'Updated',
    });
  });
});

describe('useDeleteProject', () => {
  it('calls api.del with the correct path', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteProject());
    result.current.mutate('p1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.del).toHaveBeenCalledWith('/projects/p1');
  });
});
