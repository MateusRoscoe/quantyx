'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, Search } from 'lucide-react';
import {
  useAnalyticsPages,
  useAnalyticsPagesTable,
} from '@/hooks/use-analytics-pages';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  ChartCard,
  DataTable,
  PageHeader,
  MonoCell,
  NumberCell,
  tooltipStyle,
  axisStyle,
  gridStyle,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';

type PageRow = { path: string; views: number; uniqueUsers: number };

const columns: ColumnDef<PageRow, unknown>[] = [
  { accessorKey: 'path', header: 'Path', cell: MonoCell },
  { accessorKey: 'views', header: 'Views', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

export default function PagesPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsPages(projectId);
  const top10 = data?.pages?.slice(0, 10) ?? [];

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data: tableData,
    isLoading: tableLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAnalyticsPagesTable(projectId, {
    limit: 25,
    search: debouncedSearch || undefined,
  });

  const allPages = useMemo(
    () => tableData?.pages.flatMap((p) => p.pages) ?? [],
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
      <PageHeader title="Pages" showFilterBar={false} />

      <ChartCard
        title="Top 10 Pages by Views"
        isLoading={isLoading}
        isEmpty={top10.length === 0}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={top10}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 120 }}
          >
            <CartesianGrid {...gridStyle} horizontal={false} />
            <XAxis type="number" {...axisStyle} />
            <YAxis
              type="category"
              dataKey="path"
              {...axisStyle}
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="views"
              fill="var(--color-chart-1)"
              radius={[0, 4, 4, 0]}
              animationDuration={750}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">All Pages</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search paths..."
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
            data={allPages}
            isLoading={tableLoading}
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
