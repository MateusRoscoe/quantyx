import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface PagesData {
  pages: { path: string; views: number; uniqueUsers: number }[];
}

export function useAnalyticsPages(projectId: string) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: ['analytics', 'pages', projectId, fromStr, toStr],
    queryFn: () =>
      analyticsApi.get<PagesData>(`/projects/${projectId}/pages`, {
        from: fromStr,
        to: toStr,
      }),
    enabled: !!projectId,
  });
}
