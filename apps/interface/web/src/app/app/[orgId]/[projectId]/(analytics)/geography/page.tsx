'use client';

import { useParams } from 'next/navigation';
import { useAnalyticsGeography } from '@/hooks/use-analytics-geography';
import { DataTable, PageHeader, NumberCell } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

type CountryRow = { country: string; count: number; uniqueUsers: number };

const columns: ColumnDef<CountryRow, unknown>[] = [
  { accessorKey: 'country', header: 'Country' },
  { accessorKey: 'count', header: 'Events', cell: NumberCell },
  { accessorKey: 'uniqueUsers', header: 'Unique Users', cell: NumberCell },
];

export default function GeographyPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsGeography(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Geography" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Countries</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.countries ?? []}
            isLoading={isLoading}
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
