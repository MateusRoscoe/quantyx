import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
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

interface PagesTableData {
  pages: { path: string; views: number; uniqueUsers: number }[];
  hasMore: boolean;
}

export function useAnalyticsPagesTable(
  projectId: string,
  opts?: { limit?: number; search?: string },
) {
  const { fromStr, toStr } = useDateRange();
  const limit = opts?.limit ?? 50;
  const search = opts?.search;

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'pages-table',
      projectId,
      fromStr,
      toStr,
      limit,
      search,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<PagesTableData>(`/projects/${projectId}/pages`, {
        from: fromStr,
        to: toStr,
        limit: String(limit),
        ...(search && { search }),
        ...(pageParam && {
          cursor_views: pageParam.cursorViews,
          cursor_path: pageParam.cursorPath,
        }),
      }),
    initialPageParam: null as {
      cursorViews: string;
      cursorPath: string;
    } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.pages.length === 0) return undefined;
      const last = lastPage.pages[lastPage.pages.length - 1];
      return { cursorViews: String(last.views), cursorPath: last.path };
    },
    enabled: !!projectId,
  });
}
