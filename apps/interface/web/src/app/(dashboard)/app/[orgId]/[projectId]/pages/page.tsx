'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalyticsPages } from '@/hooks/use-analytics-pages';
import { ChartCard } from '@/components/dashboard/chart-card';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

const columns: ColumnDef<{ path: string; views: number; uniqueUsers: number }, unknown>[] = [
  { accessorKey: 'path', header: 'Path', cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span> },
  { accessorKey: 'views', header: 'Views', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

function PagesContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsPages(projectId);
  const top10 = data?.pages?.slice(0, 10) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Pages" />

      <ChartCard title="Top 10 Pages" isLoading={isLoading}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis type="category" dataKey="path" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={120} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-popover)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="views" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} animationDuration={750} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader><CardTitle className="text-base font-medium">All Pages</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.pages ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function PagesPage() {
  return <Suspense><PagesContent /></Suspense>;
}
