'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, Search } from 'lucide-react';
import {
  useAnalyticsEvents,
  useAnalyticsEventsTable,
} from '@/hooks/use-analytics-events';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  ChartCard,
  DataTable,
  MonoCell,
  NumberCell,
  CHART_COLORS,
  tooltipStyle,
  axisStyle,
  gridStyle,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';

type EventRow = { eventName: string; count: number; uniqueUsers: number };

const columns: ColumnDef<EventRow, unknown>[] = [
  { accessorKey: 'eventName', header: 'Event Name', cell: MonoCell },
  { accessorKey: 'count', header: 'Count', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

export function EventsAnalyticsView({ projectId }: { projectId: string }) {
  const { data, isLoading } = useAnalyticsEvents(projectId);

  const topEvents = data?.breakdown?.slice(0, 5).map((e) => e.eventName) ?? [];
  const chartData: Record<string, string | number>[] = [];

  if (data?.timeseries) {
    const byHour = new Map<string, Record<string, number>>();
    for (const row of data.timeseries) {
      if (!topEvents.includes(row.eventName)) continue;
      const entry = byHour.get(row.hour) ?? {};
      entry[row.eventName] = row.count;
      byHour.set(row.hour, entry);
    }
    for (const [hour, values] of byHour) {
      chartData.push({ hour, ...values });
    }
    chartData.sort((a, b) => String(a.hour).localeCompare(String(b.hour)));
  }

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data: tableData,
    isLoading: tableLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAnalyticsEventsTable(projectId, {
    limit: 25,
    search: debouncedSearch || undefined,
  });

  const allEvents = useMemo(
    () => tableData?.pages.flatMap((p) => p.breakdown) ?? [],
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
      <ChartCard
        title="Events over time"
        isLoading={isLoading}
        isEmpty={chartData.length === 0}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="hour" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {topEvents.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="1"
                stroke={CHART_COLORS[i]}
                fill={CHART_COLORS[i]}
                fillOpacity={0.3}
                animationDuration={750}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">All Events</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
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
            data={allEvents}
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
