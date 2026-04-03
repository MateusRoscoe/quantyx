'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAnalyticsSessions } from '@/hooks/use-analytics-sessions';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface SessionRow {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  totalEvents: number;
  pageViews: number;
  browser: string;
  country: string;
}

const columns: ColumnDef<SessionRow, unknown>[] = [
  { accessorKey: 'sessionId', header: 'Session', cell: (info) => <span className="font-mono text-xs">{(info.getValue() as string).slice(0, 12)}...</span> },
  { accessorKey: 'userId', header: 'User', cell: (info) => { const v = info.getValue() as string; return <span className="text-sm">{v ? v.slice(0, 12) + '...' : '(anonymous)'}</span>; } },
  { accessorKey: 'startedAt', header: 'Started', cell: (info) => <span className="text-sm">{new Date(info.getValue() as string).toLocaleString()}</span> },
  { accessorKey: 'totalEvents', header: 'Events', cell: (info) => <span className="font-mono tabular-nums">{info.getValue() as number}</span> },
  { accessorKey: 'pageViews', header: 'Pages', cell: (info) => <span className="font-mono tabular-nums">{info.getValue() as number}</span> },
  { accessorKey: 'browser', header: 'Browser' },
  { accessorKey: 'country', header: 'Country' },
];

function SessionsContent() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const router = useRouter();
  const { data, isLoading } = useAnalyticsSessions(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Sessions" />
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">Recent Sessions</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.sessions ?? []}
            isLoading={isLoading}
            pageSize={20}
            onRowClick={(row) => router.push(`/app/${orgId}/${projectId}/sessions/${row.sessionId}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SessionsPage() {
  return <Suspense><SessionsContent /></Suspense>;
}
