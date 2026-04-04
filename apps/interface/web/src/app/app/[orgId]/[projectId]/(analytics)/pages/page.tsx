'use client';

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
import { useAnalyticsPages } from '@/hooks/use-analytics-pages';
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

  return (
    <div className="space-y-6">
      <PageHeader title="Pages" showFilterBar={false} />

      <ChartCard
        title="Top 10 Pages"
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
          <CardTitle className="text-base font-medium">All Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.pages ?? []}
            isLoading={isLoading}
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
