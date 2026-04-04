import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface OverviewData {
  kpis: {
    totalEvents: number;
    uniqueUsers: number;
    totalSessions: number;
    pageViews: number;
  };
  timeseries: { hour: string; events: number; users: number }[];
}

export function useAnalyticsOverview(projectId: string) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: ['analytics', 'overview', projectId, fromStr, toStr],
    queryFn: () =>
      analyticsApi.get<OverviewData>(`/projects/${projectId}/overview`, {
        from: fromStr,
        to: toStr,
      }),
    enabled: !!projectId,
  });
}
