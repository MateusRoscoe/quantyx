'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useAnalyticsPropertiesTable } from '@/hooks/use-analytics-properties';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  DataTable,
  PageHeader,
  MonoCell,
  NumberCell,
  DateTimeCell,
} from '@/components/dashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';

interface PropertyRow {
  name: string;
  type: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  uniqueValues: number;
  exampleValue: string;
}

const columns: ColumnDef<PropertyRow, unknown>[] = [
  { accessorKey: 'name', header: 'Property', cell: MonoCell },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: (info) => (
      <Badge variant="secondary" className="text-xs">
        {info.getValue() as string}
      </Badge>
    ),
  },
  { accessorKey: 'eventCount', header: 'Events', cell: NumberCell },
  { accessorKey: 'uniqueValues', header: 'Cardinality', cell: NumberCell },
  {
    accessorKey: 'exampleValue',
    header: 'Example',
    cell: (info) => (
      <span className="max-w-48 truncate font-mono text-xs text-muted-foreground">
        {info.getValue() as string}
      </span>
    ),
  },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: DateTimeCell },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateTimeCell },
];

export default function PropertiesPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 600);

  const {
    data: tableData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAnalyticsPropertiesTable(projectId, {
    limit: 25,
    search: debouncedSearch || undefined,
  });

  const allProperties = useMemo(
    () => tableData?.pages.flatMap((p) => p.properties) ?? [],
    [tableData],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Properties"
        showDateRange={false}
        showFilterBar={false}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              All Tracked Properties
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={allProperties}
            isLoading={isLoading}
            disablePagination
            disableSorting
          />
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
