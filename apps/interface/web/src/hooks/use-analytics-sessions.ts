import { useInfiniteQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface Session {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  totalEvents: number;
  pageViews: number;
  browser: string;
  os: string;
  deviceType: string;
  country: string;
  properties?: Record<string, string | number | boolean>;
  serverProperties?: Record<string, string | number | boolean>;
}

interface SessionsData {
  sessions: Session[];
  hasMore: boolean;
}

export function useAnalyticsSessions(
  projectId: string,
  opts?: { limit?: number; direction?: 'asc' | 'desc'; userId?: string },
) {
  const { fromStr, toStr } = useDateRange();
  const direction = opts?.direction ?? 'desc';
  const limit = opts?.limit ?? 50;
  const userId = opts?.userId;

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'sessions',
      projectId,
      fromStr,
      toStr,
      direction,
      limit,
      userId,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<SessionsData>(`/projects/${projectId}/sessions`, {
        from: fromStr,
        to: toStr,
        limit: String(limit),
        direction,
        ...(userId && { user_id: userId }),
        ...(pageParam && {
          cursor_ts: pageParam.cursorTs,
          cursor_id: pageParam.cursorId,
        }),
      }),
    initialPageParam: null as { cursorTs: string; cursorId: string } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.sessions.length === 0) return undefined;
      const last = lastPage.sessions[lastPage.sessions.length - 1];
      return { cursorTs: last.startedAt, cursorId: last.sessionId };
    },
    enabled: !!projectId,
  });
}

interface SessionEvent {
  event_id: string;
  event_name: string;
  timestamp: string;
  user_id: string;
  path: string;
  props_str: string;
}

interface SessionDetailData {
  session: Session | null;
  events: SessionEvent[];
  hasMore: boolean;
}

export function useSessionDetail(
  projectId: string,
  sessionId: string,
  opts?: { direction?: 'asc' | 'desc'; limit?: number },
) {
  const direction = opts?.direction ?? 'asc';
  const limit = opts?.limit ?? 50;

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'session-detail',
      projectId,
      sessionId,
      direction,
      limit,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<SessionDetailData>(
        `/projects/${projectId}/sessions/${sessionId}`,
        {
          limit: String(limit),
          direction,
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
    enabled: !!(projectId && sessionId),
  });
}
