'use client';

import { useParams } from 'next/navigation';
import { useAnalyticsProperties } from '@/hooks/use-analytics-properties';
import { DataTable, PageHeader, MonoCell, NumberCell, DateCell } from '@/components/dashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface PropertyRow {
  name: string;
  type: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  exampleValue: string;
}

const columns: ColumnDef<PropertyRow, unknown>[] = [
  { accessorKey: 'name', header: 'Property', cell: MonoCell },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: (info) => <Badge variant="secondary" className="text-xs">{info.getValue() as string}</Badge>,
  },
  { accessorKey: 'eventCount', header: 'Events', cell: NumberCell },
  {
    accessorKey: 'exampleValue',
    header: 'Example',
    cell: (info) => (
      <span className="max-w-48 truncate font-mono text-xs text-muted-foreground">
        {info.getValue() as string}
      </span>
    ),
  },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: DateCell },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateCell },
];

export default function PropertiesPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsProperties(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Custom Properties" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">All Tracked Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.properties ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}
