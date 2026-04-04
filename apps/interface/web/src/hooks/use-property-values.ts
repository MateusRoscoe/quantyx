import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';

interface PropertyValuesData {
  values: string[];
}

export function usePropertyValues(
  projectId: string,
  propertyName: string,
  propertyType: 'str' | 'num' | 'bool',
  search?: string,
) {
  return useQuery({
    queryKey: [
      'analytics',
      'property-values',
      projectId,
      propertyName,
      propertyType,
      search,
    ],
    queryFn: () =>
      analyticsApi.get<PropertyValuesData>(
        `/projects/${projectId}/properties/${encodeURIComponent(propertyName)}/values`,
        {
          type: propertyType,
          ...(search && { search }),
        },
      ),
    enabled: !!(projectId && propertyName),
  });
}
