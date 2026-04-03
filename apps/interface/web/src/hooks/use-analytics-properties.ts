import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';

interface PropertiesData {
  properties: {
    name: string;
    type: string;
    firstSeen: string;
    lastSeen: string;
    eventCount: number;
    exampleValue: string;
  }[];
}

export function useAnalyticsProperties(projectId: string) {
  return useQuery({
    queryKey: ['analytics', 'properties', projectId],
    queryFn: () =>
      analyticsApi.get<PropertiesData>(`/projects/${projectId}/properties`),
    enabled: !!projectId,
  });
}
