import { useInfiniteQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface RawEvent {
  event_id: string;
  event_name: string;
  timestamp: string;
  user_id: string;
  session_id: string;
  browser: string;
  os: string;
  device_type: string;
  country: string;
  props_str: Record<string, string>;
  props_num: Record<string, number>;
  props_bool: Record<string, number>;
}

interface EventFeedData {
  events: RawEvent[];
  hasMore: boolean;
}

export type { RawEvent };

export function useEventsFeed(
  projectId: string,
  opts?: {
    direction?: 'asc' | 'desc';
    limit?: number;
    filters?: Record<string, string>;
  },
) {
  const { fromStr, toStr } = useDateRange();
  const direction = opts?.direction ?? 'desc';
  const limit = opts?.limit ?? 50;
  const filters = opts?.filters ?? {};

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'events-feed',
      projectId,
      fromStr,
      toStr,
      direction,
      limit,
      filters,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<EventFeedData>(
        `/projects/${projectId}/events/feed`,
        {
          from: fromStr,
          to: toStr,
          limit: String(limit),
          direction,
          ...filters,
          ...(pageParam && {
            cursor_ts: pageParam.cursorTs,
            cursor_id: pageParam.cursorId,
          }),
        },
      ),
    initialPageParam: null as { cursorTs: string; cursorId: string } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.events.length === 0) return undefined;
      const last = lastPage.events[lastPage.events.length - 1];
      return { cursorTs: last.timestamp, cursorId: last.event_id };
    },
    enabled: !!projectId,
  });
}
