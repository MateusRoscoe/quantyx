import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface DimensionBreakdown {
  value: string;
  count: number;
  uniqueUsers: number;
}

interface DevicesData {
  deviceTypes: DimensionBreakdown[];
  browsers: DimensionBreakdown[];
  operatingSystems: DimensionBreakdown[];
}

export function useAnalyticsDevices(projectId: string) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: ['analytics', 'devices', projectId, fromStr, toStr],
    queryFn: () =>
      analyticsApi.get<DevicesData>(`/projects/${projectId}/devices`, {
        from: fromStr,
        to: toStr,
      }),
    enabled: !!projectId,
  });
}
