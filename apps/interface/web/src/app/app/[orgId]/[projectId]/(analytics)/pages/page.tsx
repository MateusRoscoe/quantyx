'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FileText,
  Files,
  Users,
  BarChart3,
  Loader2,
  Search,
} from 'lucide-react';
import {
  useAnalyticsPages,
  useAnalyticsPagesTable,
  usePageDetail,
} from '@/hooks/use-analytics-pages';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { BrowserIcon, DeviceIcon } from '@/lib/dimension-icons';
import {
  ChartCard,
  DataTable,
  PageHeader,
  StatCard,
  MonoCell,
  NumberCell,
  tooltipStyle,
  axisStyle,
  gridStyle,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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

  const kpis = data?.kpis;
  const timeseries = data?.timeseries ?? [];
  const granularity = data?.granularity ?? 'day';
  const screenSizes = data?.screenSizes ?? [];
  const top10 = data?.pages?.slice(0, 10) ?? [];

  // Table state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 600);

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

  // Infinite scroll
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

  // Drill-down sheet
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: pageDetail, isLoading: detailLoading } = usePageDetail(
    projectId,
    selectedPath,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Pages" showFilterBar={false} />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Page Views"
          icon={FileText}
          value={kpis?.totalPageViews ?? 0}
          sparklineData={timeseries.map((d) => ({ value: d.views }))}
          isLoading={isLoading}
        />
        <StatCard
          label="Unique Pages"
          icon={Files}
          value={kpis?.uniquePages ?? 0}
          isLoading={isLoading}
        />
        <StatCard
          label="Unique Users"
          icon={Users}
          value={kpis?.uniqueUsers ?? 0}
          sparklineData={timeseries.map((d) => ({ value: d.users }))}
          isLoading={isLoading}
        />
        <StatCard
          label="Avg Views / Page"
          icon={BarChart3}
          value={kpis?.avgViewsPerPage ?? 0}
          isLoading={isLoading}
        />
      </div>

      {/* Page Views Over Time */}
      <ChartCard
        title="Page Views Over Time"
        isLoading={isLoading}
        isEmpty={timeseries.length === 0}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={timeseries}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="pageViewsFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis
              dataKey="time"
              {...axisStyle}
              tickFormatter={(v) =>
                granularity === 'hour'
                  ? new Date(v).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : new Date(v).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })
              }
            />
            <YAxis {...axisStyle} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) =>
                granularity === 'hour'
                  ? new Date(v).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : new Date(v).toLocaleDateString([], {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
              }
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#pageViewsFill)"
              animationDuration={750}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top 10 + Screen Sizes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top 10 Pages"
          isLoading={isLoading}
          isEmpty={top10.length === 0}
        >
          <ResponsiveContainer width="100%" height={350}>
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
                tickFormatter={(v: string) =>
                  v.length > 25 ? `...${v.slice(-22)}` : v
                }
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="views"
                fill="var(--color-chart-1)"
                radius={[0, 4, 4, 0]}
                animationDuration={750}
                cursor="pointer"
                onClick={(data) => {
                  if (data?.path) setSelectedPath(data.path);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Screen Sizes"
          isLoading={isLoading}
          isEmpty={screenSizes.length === 0}
        >
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={screenSizes.slice(0, 10)}
              layout="vertical"
              margin={{ left: 80 }}
            >
              <CartesianGrid {...gridStyle} horizontal={false} />
              <XAxis type="number" {...axisStyle} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="screenSize"
                {...axisStyle}
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="count"
                fill="var(--color-chart-2)"
                radius={[0, 4, 4, 0]}
                animationDuration={750}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* All Pages Table */}
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
            onRowClick={(row) => setSelectedPath(row.path)}
          />
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Page Detail Drill-Down Sheet */}
      <Sheet
        open={selectedPath !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPath(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="font-mono text-sm break-all">
              {selectedPath}
            </SheetTitle>
            <SheetDescription>
              Device and screen breakdown for this page
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-4">
            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {/* Screen Sizes */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Screen Sizes</h4>
                  {pageDetail?.screenSizes?.length ? (
                    <div className="space-y-2">
                      {pageDetail.screenSizes.slice(0, 10).map((item) => {
                        const total = pageDetail.screenSizes.reduce(
                          (s, d) => s + d.count,
                          0,
                        );
                        const pct = total > 0 ? (item.count / total) * 100 : 0;
                        return (
                          <div
                            key={item.screenSize}
                            className="flex items-center gap-2"
                          >
                            <span className="w-24 truncate font-mono text-xs">
                              {item.screenSize}
                            </span>
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: 'var(--color-chart-2)',
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No screen size data available
                    </p>
                  )}
                </div>

                {/* Device Types */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Device Types</h4>
                  {pageDetail?.deviceTypes?.length ? (
                    <div className="space-y-2">
                      {pageDetail.deviceTypes.map((item) => {
                        const total = pageDetail.deviceTypes.reduce(
                          (s, d) => s + d.count,
                          0,
                        );
                        const pct = total > 0 ? (item.count / total) * 100 : 0;
                        return (
                          <div
                            key={item.value}
                            className="flex items-center gap-2"
                          >
                            <span className="flex w-24 items-center gap-1.5 truncate text-sm">
                              <DeviceIcon
                                deviceType={item.value}
                                className="h-3.5 w-3.5 shrink-0"
                              />
                              {item.value || '(unknown)'}
                            </span>
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No device data available
                    </p>
                  )}
                </div>

                {/* Browsers */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Browsers</h4>
                  {pageDetail?.browsers?.length ? (
                    <div className="space-y-2">
                      {pageDetail.browsers.slice(0, 8).map((item) => {
                        const total = pageDetail.browsers.reduce(
                          (s, d) => s + d.count,
                          0,
                        );
                        const pct = total > 0 ? (item.count / total) * 100 : 0;
                        return (
                          <div
                            key={item.value}
                            className="flex items-center gap-2"
                          >
                            <span className="flex w-24 items-center gap-1.5 truncate text-sm">
                              <BrowserIcon
                                browser={item.value}
                                className="h-3.5 w-3.5 shrink-0"
                              />
                              {item.value || '(unknown)'}
                            </span>
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: 'var(--color-chart-3)',
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No browser data available
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
