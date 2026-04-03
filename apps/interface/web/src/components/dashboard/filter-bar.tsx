'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFilters, type AnalyticsFilters } from '@/hooks/use-filters';

const filterLabels: Record<keyof AnalyticsFilters, string> = {
  browser: 'Browser',
  os: 'OS',
  country: 'Country',
  device_type: 'Device',
  event_name: 'Event',
  path: 'Path',
};

export function FilterBar() {
  const { filters, removeFilter, clearFilters, activeFilterCount } =
    useFilters();

  if (activeFilterCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      {(Object.entries(filters) as [keyof AnalyticsFilters, string[]][]).map(
        ([key, values]) =>
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
                    // setFilter handled via removeFilter for simplicity
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
    </div>
  );
}
