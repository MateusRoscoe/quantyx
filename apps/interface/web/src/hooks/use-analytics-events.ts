import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface EventsData {
  breakdown: { eventName: string; count: number; uniqueUsers: number }[];
  timeseries: { hour: string; eventName: string; count: number }[];
}

export function useAnalyticsEvents(projectId: string) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: ['analytics', 'events', projectId, fromStr, toStr],
    queryFn: () =>
      analyticsApi.get<EventsData>(`/projects/${projectId}/events`, {
        from: fromStr,
        to: toStr,
      }),
    enabled: !!projectId,
  });
}

interface EventsTableData {
  breakdown: { eventName: string; count: number; uniqueUsers: number }[];
  hasMore: boolean;
}

export function useAnalyticsEventsTable(
  projectId: string,
  opts?: { limit?: number; search?: string },
) {
  const { fromStr, toStr } = useDateRange();
  const limit = opts?.limit ?? 50;
  const search = opts?.search;

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'events-table',
      projectId,
      fromStr,
      toStr,
      limit,
      search,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<EventsTableData>(`/projects/${projectId}/events`, {
        from: fromStr,
        to: toStr,
        limit: String(limit),
        ...(search && { search }),
        ...(pageParam && {
          cursor_count: pageParam.cursorCount,
          cursor_event: pageParam.cursorEvent,
        }),
      }),
    initialPageParam: null as {
      cursorCount: string;
      cursorEvent: string;
    } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.breakdown.length === 0)
        return undefined;
      const last = lastPage.breakdown[lastPage.breakdown.length - 1];
      return { cursorCount: String(last.count), cursorEvent: last.eventName };
    },
    enabled: !!projectId,
  });
}
