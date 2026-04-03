'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useAnalyticsProperties } from '@/hooks/use-analytics-properties';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
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
  { accessorKey: 'name', header: 'Property', cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span> },
  { accessorKey: 'type', header: 'Type', cell: (info) => <Badge variant="secondary" className="text-xs">{info.getValue() as string}</Badge> },
  { accessorKey: 'eventCount', header: 'Events', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
  { accessorKey: 'exampleValue', header: 'Example', cell: (info) => <span className="max-w-48 truncate font-mono text-xs text-muted-foreground">{info.getValue() as string}</span> },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: (info) => <span className="text-sm">{new Date(info.getValue() as string).toLocaleDateString()}</span> },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: (info) => <span className="text-sm">{new Date(info.getValue() as string).toLocaleDateString()}</span> },
];

function PropertiesContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsProperties(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Custom Properties" />
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">All Tracked Properties</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data?.properties ?? []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function PropertiesPage() {
  return <Suspense><PropertiesContent /></Suspense>;
}
