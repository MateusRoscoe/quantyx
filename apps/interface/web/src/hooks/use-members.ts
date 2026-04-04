import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: ['members', orgId],
    queryFn: () => api.get<Member[]>(`/organizations/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useAddMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: 'admin' | 'member' }) =>
      api.post<Member>(`/organizations/${orgId}/members`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', orgId] });
    },
  });
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: 'admin' | 'member';
    }) =>
      api.patch<Member>(`/organizations/${orgId}/members/${memberId}`, {
        role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', orgId] });
    },
  });
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      api.del(`/organizations/${orgId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', orgId] });
    },
  });
}
