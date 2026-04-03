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
import { useAnalyticsEvents } from '@/hooks/use-analytics-events';
import { ChartCard } from '@/components/dashboard/chart-card';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

const columns: ColumnDef<{ eventName: string; count: number; uniqueUsers: number }, unknown>[] = [
  { accessorKey: 'eventName', header: 'Event Name', cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span> },
  { accessorKey: 'count', header: 'Count', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

function EventsContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsEvents(projectId);

  const topEvents = data?.breakdown?.slice(0, 5).map((e) => e.eventName) ?? [];
  const chartData: Record<string, string | number>[] = [];

  if (data?.timeseries) {
    const byDate = new Map<string, Record<string, number>>();
    for (const row of data.timeseries) {
      if (!topEvents.includes(row.eventName)) continue;
      const entry = byDate.get(row.date) ?? {};
      entry[row.eventName] = row.count;
      byDate.set(row.date, entry);
    }
    for (const [date, values] of byDate) {
      chartData.push({ date, ...values });
    }
    chartData.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Events" />

      <ChartCard title="Events over time" isLoading={isLoading}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-popover)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
            {topEvents.map((name, i) => (
              <Area key={name} type="monotone" dataKey={name} stackId="1" stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.3} animationDuration={750} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader><CardTitle className="text-base font-medium">All Events</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.breakdown ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function EventsPage() {
  return <Suspense><EventsContent /></Suspense>;
}
