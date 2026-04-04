import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';
import { useDateRange } from './use-date-range';

interface DimensionRow {
  value: string;
  count: number;
  uniqueUsers: number;
}

interface CountryRow {
  country: string;
  count: number;
  uniqueUsers: number;
}

interface CityRow extends DimensionRow {
  latitude: number;
  longitude: number;
}

export interface GeographyData {
  continents: DimensionRow[];
  countries: CountryRow[];
  regions: DimensionRow[];
  cities: CityRow[];
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

interface DrillDownData {
  data: (DimensionRow & { latitude?: number; longitude?: number })[];
}

export function useGeographyDrillDown(
  projectId: string,
  params: {
    dimension: 'country' | 'city' | 'state';
    continent?: string;
    country?: string;
    limit?: number;
  } | null,
) {
  const { fromStr, toStr } = useDateRange();

  return useQuery({
    queryKey: [
      'analytics',
      'geography',
      'drill-down',
      projectId,
      fromStr,
      toStr,
      params,
    ],
    queryFn: () => {
      const query: Record<string, string> = {
        from: fromStr,
        to: toStr,
        dimension: params!.dimension,
      };
      if (params!.continent) query.continent = params!.continent;
      if (params!.country) query.country = params!.country;
      if (params!.limit) query.limit = String(params!.limit);
      return analyticsApi.get<DrillDownData>(
        `/projects/${projectId}/geography/drill-down`,
        query,
      );
    },
    enabled: !!projectId && !!params,
  });
}
