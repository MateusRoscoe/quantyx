import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface UserListItem {
  userId: string;
  lastSeen: string;
  eventsInPeriod: number;
}

interface UsersListData {
  users: UserListItem[];
  hasMore: boolean;
}

interface UserDetail {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
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
      analyticsApi.get<UsersListData>(`/projects/${projectId}/users`, {
        from: fromStr,
        to: toStr,
        limit: String(limit),
        ...(pageParam && {
          cursor_ts: pageParam.cursorTs,
          cursor_id: pageParam.cursorId,
        }),
      }),
    initialPageParam: null as {
      cursorTs: string;
      cursorId: string;
    } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.users.length === 0) return undefined;
      const last = lastPage.users[lastPage.users.length - 1];
      return { cursorTs: last.lastSeen, cursorId: last.userId };
    },
    enabled: !!projectId,
  });
}

export function useAnalyticsUser(projectId: string, userId: string) {
  return useQuery({
    queryKey: ['analytics', 'user', projectId, userId],
    queryFn: () =>
      analyticsApi.get<UserDetail>(`/projects/${projectId}/users/${userId}`),
    enabled: !!projectId && !!userId,
  });
}
