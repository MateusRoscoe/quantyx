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
  user_id?: string[];
  session_id?: string[];
}

export interface PropertyFilterEntry {
  type: 'str' | 'num' | 'bool';
  name: string;
  value: string;
}

const FILTER_KEYS: (keyof AnalyticsFilters)[] = [
  'browser',
  'os',
  'country',
  'device_type',
  'event_name',
  'path',
  'user_id',
  'session_id',
];

const PROP_PREFIX_RE = /^prop_(str|num|bool)\.(.+)$/;

export function useFilters() {
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

  const propertyFilters = useMemo(() => {
    const result: PropertyFilterEntry[] = [];
    searchParams.forEach((value, key) => {
      const match = key.match(PROP_PREFIX_RE);
      if (match) {
        result.push({
          type: match[1] as 'str' | 'num' | 'bool',
          name: match[2],
          value,
        });
      }
    });
    return result;
  }, [searchParams]);

  const activeFilterCount = useMemo(
    () => Object.keys(filters).length + propertyFilters.length,
    [filters, propertyFilters],
  );

  const filterParams = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    for (const pf of propertyFilters) {
      result[`prop_${pf.type}.${pf.name}`] = pf.value;
    }
    return result;
  }, [searchParams, propertyFilters]);

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

  const setPropertyFilter = useCallback(
    (type: 'str' | 'num' | 'bool', name: string, value: string) => {
      updateParams((params) => {
        params.set(`prop_${type}.${name}`, value);
      });
    },
    [updateParams],
  );

  const removePropertyFilter = useCallback(
    (type: 'str' | 'num' | 'bool', name: string) => {
      updateParams((params) => {
        params.delete(`prop_${type}.${name}`);
      });
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    updateParams((params) => {
      for (const key of FILTER_KEYS) {
        params.delete(key);
      }
      // Clear property filters
      const toDelete: string[] = [];
      params.forEach((_, key) => {
        if (PROP_PREFIX_RE.test(key)) toDelete.push(key);
      });
      for (const key of toDelete) params.delete(key);
    });
  }, [updateParams]);

  return {
    filters,
    propertyFilters,
    setFilter,
    removeFilter,
    setPropertyFilter,
    removePropertyFilter,
    clearFilters,
    activeFilterCount,
    filterParams,
  };
}
