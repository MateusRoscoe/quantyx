import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface UsersData {
  users: {
    userId: string;
    firstSeen: string;
    lastSeen: string;
    totalEvents: number;
  }[];
}

export function useAnalyticsUsers(
  projectId: string,
  opts?: { limit?: number; offset?: number },
) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: [
      'analytics',
      'users',
      projectId,
      fromStr,
      toStr,
      opts?.limit,
      opts?.offset,
    ],
    queryFn: () =>
      analyticsApi.get<UsersData>(`/projects/${projectId}/users`, {
        from: fromStr,
        to: toStr,
        ...(opts?.limit !== undefined && { limit: String(opts.limit) }),
        ...(opts?.offset !== undefined && { offset: String(opts.offset) }),
      }),
    enabled: !!projectId,
  });
}
