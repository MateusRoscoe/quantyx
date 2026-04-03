'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Zap, Users, Activity, FileText } from 'lucide-react';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';
import { useAnalyticsEvents } from '@/hooks/use-analytics-events';
import { useAnalyticsPages } from '@/hooks/use-analytics-pages';
import { useAnalyticsDevices } from '@/hooks/use-analytics-devices';
import { StatCard } from '@/components/dashboard/stat-card';
import { ChartCard } from '@/components/dashboard/chart-card';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

const eventColumns: ColumnDef<{ eventName: string; count: number; uniqueUsers: number }, unknown>[] = [
  { accessorKey: 'eventName', header: 'Event', cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span> },
  { accessorKey: 'count', header: 'Count', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'uniqueUsers', header: 'Users', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

const pageColumns: ColumnDef<{ path: string; views: number; uniqueUsers: number }, unknown>[] = [
  { accessorKey: 'path', header: 'Path', cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span> },
  { accessorKey: 'views', header: 'Views', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'uniqueUsers', header: 'Users', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

function OverviewContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(projectId);
  const { data: eventsData, isLoading: eventsLoading } = useAnalyticsEvents(projectId);
  const { data: pagesData, isLoading: pagesLoading } = useAnalyticsPages(projectId);
  const { data: devicesData } = useAnalyticsDevices(projectId);

  const kpis = overview?.kpis;
  const timeseries = overview?.timeseries ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Events"
          icon={Zap}
          value={kpis?.totalEvents ?? '--'}
          sparklineData={timeseries.map((d) => ({ value: d.events }))}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Unique Users"
          icon={Users}
          value={kpis?.uniqueUsers ?? '--'}
          sparklineData={timeseries.map((d) => ({ value: d.users }))}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Sessions"
          icon={Activity}
          value={kpis?.totalSessions ?? '--'}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Page Views"
          icon={FileText}
          value={kpis?.pageViews ?? '--'}
          isLoading={overviewLoading}
        />
      </div>

      {/* Time Series Chart */}
      <ChartCard title="Events over time" isLoading={overviewLoading}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeseries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-popover)',
                borderColor: 'var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#areaFill)"
              animationDuration={750}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tables Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top Events</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={eventColumns}
              data={eventsData?.breakdown?.slice(0, 10) ?? []}
              isLoading={eventsLoading}
              pageSize={10}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={pageColumns}
              data={pagesData?.pages?.slice(0, 10) ?? []}
              isLoading={pagesLoading}
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      {/* Device Breakdown */}
      {devicesData && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { title: 'Device Types', data: devicesData.deviceTypes },
            { title: 'Browsers', data: devicesData.browsers },
            { title: 'Operating Systems', data: devicesData.operatingSystems },
          ].map(({ title, data }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-base font-medium">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.slice(0, 5).map((item) => {
                    const total = data.reduce((s, d) => s + d.count, 0);
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={item.value} className="flex items-center gap-2">
                        <span className="w-24 truncate text-sm">{item.value || '(unknown)'}</span>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense>
      <OverviewContent />
    </Suspense>
  );
}
