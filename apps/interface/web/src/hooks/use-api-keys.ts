import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ApiKey {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyCreated extends ApiKey {
  key: string;
}

export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api.get<ApiKey[]>(`/projects/${projectId}/api-keys`),
    enabled: !!projectId,
  });
}

export function useCreateApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; expiresAt?: string }) =>
      api.post<ApiKeyCreated>(`/projects/${projectId}/api-keys`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });
}

export function useDeleteApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });
}
