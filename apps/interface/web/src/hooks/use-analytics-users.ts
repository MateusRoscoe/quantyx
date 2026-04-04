import { useInfiniteQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface User {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
}

interface UsersData {
  users: User[];
  hasMore: boolean;
}

export function useAnalyticsUsers(
  projectId: string,
  opts?: { limit?: number },
) {
  const { fromStr, toStr } = useDateRange();
  const limit = opts?.limit ?? 50;

  return useInfiniteQuery({
    queryKey: ['analytics', 'users', projectId, fromStr, toStr, limit],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<UsersData>(`/projects/${projectId}/users`, {
        from: fromStr,
        to: toStr,
        limit: String(limit),
        ...(pageParam && {
          cursor_events: String(pageParam.cursorEvents),
          cursor_id: pageParam.cursorId,
        }),
      }),
    initialPageParam: null as {
      cursorEvents: number;
      cursorId: string;
    } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.users.length === 0) return undefined;
      const last = lastPage.users[lastPage.users.length - 1];
      return { cursorEvents: last.totalEvents, cursorId: last.userId };
    },
    enabled: !!projectId,
  });
}
