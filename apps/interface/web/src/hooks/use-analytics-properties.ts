import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';

interface PropertyItem {
  name: string;
  type: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  uniqueValues: number;
  exampleValue: string;
}

interface PropertiesData {
  properties: PropertyItem[];
}

export function useAnalyticsProperties(projectId: string) {
  return useQuery({
    queryKey: ['analytics', 'properties', projectId],
    queryFn: () =>
      analyticsApi.get<PropertiesData>(`/projects/${projectId}/properties`),
    enabled: !!projectId,
  });
}

interface PropertiesTableData {
  properties: PropertyItem[];
  hasMore: boolean;
}

export function useAnalyticsPropertiesTable(
  projectId: string,
  opts?: { limit?: number; search?: string },
) {
  const limit = opts?.limit ?? 50;
  const search = opts?.search;

  return useInfiniteQuery({
    queryKey: ['analytics', 'properties-table', projectId, limit, search],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<PropertiesTableData>(
        `/projects/${projectId}/properties`,
        {
          limit: String(limit),
          ...(search && { search }),
          ...(pageParam && {
            cursor_count: pageParam.cursorCount,
            cursor_name: pageParam.cursorName,
          }),
        },
      ),
    initialPageParam: null as {
      cursorCount: string;
      cursorName: string;
    } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.properties.length === 0)
        return undefined;
      const last = lastPage.properties[lastPage.properties.length - 1];
      return {
        cursorCount: String(last.eventCount),
        cursorName: last.name,
      };
    },
    enabled: !!projectId,
  });
}
