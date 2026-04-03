import { useQuery } from '@tanstack/react-query';
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
}

interface SessionsData {
  sessions: Session[];
}

export function useAnalyticsSessions(
  projectId: string,
  opts?: { limit?: number; offset?: number },
) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: [
      'analytics',
      'sessions',
      projectId,
      fromStr,
      toStr,
      opts?.limit,
      opts?.offset,
    ],
    queryFn: () =>
      analyticsApi.get<SessionsData>(`/projects/${projectId}/sessions`, {
        from: fromStr,
        to: toStr,
        ...(opts?.limit !== undefined && { limit: String(opts.limit) }),
        ...(opts?.offset !== undefined && { offset: String(opts.offset) }),
      }),
    enabled: !!projectId,
  });
}

interface SessionDetailData {
  events: {
    event_id: string;
    event_name: string;
    timestamp: string;
    user_id: string;
    props_str: string;
  }[];
}

export function useSessionDetail(projectId: string, sessionId: string) {
  return useQuery({
    queryKey: ['analytics', 'session-detail', projectId, sessionId],
    queryFn: () =>
      analyticsApi.get<SessionDetailData>(
        `/projects/${projectId}/sessions/${sessionId}`,
      ),
    enabled: !!(projectId && sessionId),
  });
}
