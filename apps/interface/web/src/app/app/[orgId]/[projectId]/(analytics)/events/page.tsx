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
import { useAnalyticsEvents } from '@/hooks/use-analytics-events';
import {
  ChartCard,
  DataTable,
  PageHeader,
  MonoCell,
  NumberCell,
  CHART_COLORS,
  tooltipStyle,
  axisStyle,
  gridStyle,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

type EventRow = { eventName: string; count: number; uniqueUsers: number };

const columns: ColumnDef<EventRow, unknown>[] = [
  { accessorKey: 'eventName', header: 'Event Name', cell: MonoCell },
  { accessorKey: 'count', header: 'Count', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

export default function EventsPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
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
    for (const [date, values] of byHour) {
      chartData.push({ date, ...values });
    }
    chartData.sort((a, b) => String(a.hour).localeCompare(String(b.hour)));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Events" />

      <ChartCard title="Events over time" isLoading={isLoading} isEmpty={chartData.length === 0}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <CardTitle className="text-base font-medium">All Events</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.breakdown ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}
