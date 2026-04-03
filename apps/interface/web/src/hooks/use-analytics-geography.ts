import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface GeographyData {
  countries: { country: string; count: number; uniqueUsers: number }[];
}

export function useAnalyticsGeography(projectId: string) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: ['analytics', 'geography', projectId, fromStr, toStr],
    queryFn: () =>
      analyticsApi.get<GeographyData>(`/projects/${projectId}/geography`, {
        from: fromStr,
        to: toStr,
      }),
    enabled: !!projectId,
  });
}
