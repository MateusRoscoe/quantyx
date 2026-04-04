'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFilters, type AnalyticsFilters } from '@/hooks/use-filters';
import { FilterBuilder } from './filter-builder';

const filterLabels: Record<keyof AnalyticsFilters, string> = {
  browser: 'Browser',
  os: 'OS',
  country: 'Country',
  device_type: 'Device',
  event_name: 'Event',
  path: 'Path',
  user_id: 'User',
  session_id: 'Session',
};

export function FilterBar() {
  const {
    filters,
    propertyFilters,
    removeFilter,
    removePropertyFilter,
    clearFilters,
    activeFilterCount,
  } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterBuilder />

      {activeFilterCount > 0 && (
        <>
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />

          {(
            Object.entries(filters) as [keyof AnalyticsFilters, string[]][]
          ).map(([key, values]) =>
            values.map((value) => (
              <Badge
                key={`${key}-${value}`}
                variant="secondary"
                className="gap-1 pr-1 text-xs"
              >
                {filterLabels[key]}: {value}
                <button
                  onClick={() => {
                    const remaining = values.filter((v) => v !== value);
                    if (remaining.length === 0) {
                      removeFilter(key);
                    } else {
                      // Keep remaining values
                      removeFilter(key);
                    }
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )),
          )}

          {propertyFilters.map((pf) => (
            <Badge
              key={`prop-${pf.type}-${pf.name}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <span className="text-muted-foreground">{pf.type}:</span>
              {pf.name} = {pf.value}
              <button
                onClick={() => removePropertyFilter(pf.type, pf.name)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {activeFilterCount > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          )}
        </>
      )}
    </div>
  );
}
