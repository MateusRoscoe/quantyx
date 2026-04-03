'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface AnalyticsFilters {
  browser?: string[];
  os?: string[];
  country?: string[];
  device_type?: string[];
  event_name?: string[];
  path?: string[];
}

const FILTER_KEYS: (keyof AnalyticsFilters)[] = [
  'browser',
  'os',
  'country',
  'device_type',
  'event_name',
  'path',
];

export function useFilters(): {
  filters: AnalyticsFilters;
  setFilter: (key: keyof AnalyticsFilters, values: string[]) => void;
  removeFilter: (key: keyof AnalyticsFilters) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  filterParams: Record<string, string>;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const result: AnalyticsFilters = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        result[key] = value.split(',');
      }
    }
    return result;
  }, [searchParams]);

  const activeFilterCount = useMemo(
    () => Object.keys(filters).length,
    [filters],
  );

  const filterParams = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  }, [searchParams]);

  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      updater(params);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setFilter = useCallback(
    (key: keyof AnalyticsFilters, values: string[]) => {
      updateParams((params) => {
        if (values.length === 0) {
          params.delete(key);
        } else {
          params.set(key, values.join(','));
        }
      });
    },
    [updateParams],
  );

  const removeFilter = useCallback(
    (key: keyof AnalyticsFilters) => {
      updateParams((params) => params.delete(key));
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    updateParams((params) => {
      for (const key of FILTER_KEYS) {
        params.delete(key);
      }
    });
  }, [updateParams]);

  return {
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    activeFilterCount,
    filterParams,
  };
}
