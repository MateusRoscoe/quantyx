import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface EventsData {
  breakdown: { eventName: string; count: number; uniqueUsers: number }[];
  timeseries: { date: string; eventName: string; count: number }[];
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
