'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useAnalyticsGeography } from '@/hooks/use-analytics-geography';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface CountryRow {
  country: string;
  count: number;
  uniqueUsers: number;
}

const columns: ColumnDef<CountryRow, unknown>[] = [
  { accessorKey: 'country', header: 'Country' },
  { accessorKey: 'count', header: 'Events', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

function GeographyContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsGeography(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Geography" />
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">Countries</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.countries ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function GeographyPage() {
  return <Suspense><GeographyContent /></Suspense>;
}
