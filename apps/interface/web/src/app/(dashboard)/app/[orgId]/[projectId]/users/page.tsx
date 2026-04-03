'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAnalyticsUsers } from '@/hooks/use-analytics-users';
import { DataTable } from '@/components/dashboard/data-table';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface UserRow {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
}

const columns: ColumnDef<UserRow, unknown>[] = [
  { accessorKey: 'userId', header: 'User ID', cell: (info) => <span className="font-mono text-sm">{(info.getValue() as string).slice(0, 16)}...</span> },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: (info) => <span className="text-sm">{new Date(info.getValue() as string).toLocaleDateString()}</span> },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: (info) => <span className="text-sm">{new Date(info.getValue() as string).toLocaleDateString()}</span> },
  { accessorKey: 'totalEvents', header: 'Total Events', cell: (info) => <span className="font-mono tabular-nums">{(info.getValue() as number).toLocaleString()}</span> },
];

function UsersContent() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const router = useRouter();
  const { data, isLoading } = useAnalyticsUsers(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" />
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">All Users</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.users ?? []}
            isLoading={isLoading}
            pageSize={20}
            onRowClick={(row) => router.push(`/app/${orgId}/${projectId}/users/${row.userId}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return <Suspense><UsersContent /></Suspense>;
}
