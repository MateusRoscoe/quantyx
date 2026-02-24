import { renderHook, waitFor } from '@/test/test-utils';
import { api } from '@/lib/api';
import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
} from './use-members';

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

describe('useMembers', () => {
  it('fetches members for an organization', async () => {
    vi.mocked(api.get).mockResolvedValue([
      { id: 'm1', role: 'owner', user: { name: 'Alice' } },
    ]);
    const { result } = renderHook(() => useMembers('org1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/organizations/org1/members');
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHook(() => useMembers(''));
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useAddMember', () => {
  it('calls api.post with the correct path and body', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'm2' });
    const { result } = renderHook(() => useAddMember('org1'));
    result.current.mutate({ email: 'bob@example.com', role: 'member' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/organizations/org1/members', {
      email: 'bob@example.com',
      role: 'member',
    });
  });
});

describe('useUpdateMemberRole', () => {
  it('calls api.patch with memberId and role', async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: 'm1', role: 'admin' });
    const { result } = renderHook(() => useUpdateMemberRole('org1'));
    result.current.mutate({ memberId: 'm1', role: 'admin' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/organizations/org1/members/m1', {
      role: 'admin',
    });
  });
});

describe('useRemoveMember', () => {
  it('calls api.del with the correct path', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveMember('org1'));
    result.current.mutate('m1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.del).toHaveBeenCalledWith('/organizations/org1/members/m1');
  });
});
