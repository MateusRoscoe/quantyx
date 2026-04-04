'use client';

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
import {
  StatCard,
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
import type { ColumnDef } from '@tanstack/react-table';

type EventRow = { eventName: string; count: number; uniqueUsers: number };
type PageRow = { path: string; views: number; uniqueUsers: number };

const eventColumns: ColumnDef<EventRow, unknown>[] = [
  { accessorKey: 'eventName', header: 'Event', cell: MonoCell },
  { accessorKey: 'count', header: 'Count', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Users', cell: NumberCell },
];

const pageColumns: ColumnDef<PageRow, unknown>[] = [
  { accessorKey: 'path', header: 'Path', cell: MonoCell },
  { accessorKey: 'views', header: 'Views', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Users', cell: NumberCell },
];

export default function OverviewPage() {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Events"
          icon={Zap}
          value={kpis?.totalEvents ?? 0}
          sparklineData={timeseries.map((d: { events: number }) => ({ value: d.events }))}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Unique Users"
          icon={Users}
          value={kpis?.uniqueUsers ?? 0}
          sparklineData={timeseries.map((d) => ({ value: d.users }))}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Sessions"
          icon={Activity}
          value={kpis?.totalSessions ?? 0}
          isLoading={overviewLoading}
        />
        <StatCard
          label="Page Views"
          icon={FileText}
          value={kpis?.pageViews ?? 0}
          isLoading={overviewLoading}
        />
      </div>

      <ChartCard title="Events over time" isLoading={overviewLoading} isEmpty={timeseries.length === 0}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeseries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="hour" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
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

      {devicesData && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { title: 'Device Types', data: devicesData.deviceTypes },
            { title: 'Browsers', data: devicesData.browsers },
            { title: 'Operating Systems', data: devicesData.operatingSystems },
          ].map(({ title, data }) => {
            const total = data.reduce((s, d) => s + d.count, 0);
            return (
              <Card key={title}>
                <CardHeader>
                  <CardTitle className="text-base font-medium">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.slice(0, 5).map((item) => {
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={item.value} className="flex items-center gap-2">
                        <span className="w-24 truncate text-sm">{item.value || '(unknown)'}</span>
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
