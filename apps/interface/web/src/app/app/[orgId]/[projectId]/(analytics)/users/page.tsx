'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAnalyticsUsers } from '@/hooks/use-analytics-users';
import { DataTable, PageHeader, MonoCell, NumberCell, DateCell } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';

interface UserRow {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
}

const columns: ColumnDef<UserRow, unknown>[] = [
  { accessorKey: 'userId', header: 'User ID', cell: MonoCell },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: DateCell },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateCell },
  { accessorKey: 'totalEvents', header: 'Total Events', cell: NumberCell },
];

export default function UsersPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const router = useRouter();
  const { data, isLoading } = useAnalyticsUsers(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">All Users</CardTitle>
        </CardHeader>
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
