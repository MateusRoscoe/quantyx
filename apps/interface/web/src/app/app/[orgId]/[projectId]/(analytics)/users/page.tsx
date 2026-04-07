'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAnalyticsUsers } from '@/hooks/use-analytics-users';
import {
  DataTable,
  PageHeader,
  MonoCell,
  NumberCell,
  DateCell,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ColumnDef } from '@tanstack/react-table';

interface UserRow {
  userId: string;
  name: string | null;
  lastSeen: string;
  eventsInPeriod: number;
}

const columns: ColumnDef<UserRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => {
      const name = info.getValue() as string | null;
      return name ? (
        <span className="text-sm font-medium">{name}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  { accessorKey: 'userId', header: 'User ID', cell: MonoCell },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateCell },
  {
    accessorKey: 'eventsInPeriod',
    header: 'Events in Period',
    cell: NumberCell,
  },
];

export default function UsersPage() {
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();
  const router = useRouter();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAnalyticsUsers(projectId, { limit: 25 });

  const users = useMemo(
    () => data?.pages.flatMap((p) => p.users) ?? [],
    [data],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Users" showFilterBar={false} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            disablePagination
            disableSorting
            onRowClick={(row) =>
              router.push(`/app/${orgId}/${projectId}/users/${row.userId}`)
            }
          />
          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
