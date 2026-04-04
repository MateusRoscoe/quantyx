'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAnalyticsSessions } from '@/hooks/use-analytics-sessions';
import {
  DataTable,
  PageHeader,
  NumberCell,
  DateTimeCell,
  BrowserCell,
  CountryCell,
  TruncateWithTooltip,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  {
    accessorKey: 'sessionId',
    header: 'Session',
    cell: (info) => {
      const v = info.getValue() as string;
      return (
        <TruncateWithTooltip tooltip={v} className="font-mono text-xs">
          {v}
        </TruncateWithTooltip>
      );
    },
    size: 180,
  },
  {
    accessorKey: 'userId',
    header: 'User',
    cell: (info) => {
      const v = info.getValue() as string;
      return v ? (
        <TruncateWithTooltip tooltip={v} className="text-sm">
          {v}
        </TruncateWithTooltip>
      ) : (
        <span className="text-sm text-muted-foreground">(anonymous)</span>
      );
    },
    size: 160,
  },
  { accessorKey: 'startedAt', header: 'Started', cell: DateTimeCell },
  { accessorKey: 'totalEvents', header: 'Events', cell: NumberCell, size: 80 },
  { accessorKey: 'pageViews', header: 'Pages', cell: NumberCell, size: 80 },
  { accessorKey: 'browser', header: 'Browser', cell: BrowserCell, size: 120 },
  { accessorKey: 'country', header: 'Country', cell: CountryCell, size: 60 },
];

export default function SessionsPage() {
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();
  const router = useRouter();
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const toggleDirection = useCallback(
    () => setDirection((d) => (d === 'asc' ? 'desc' : 'asc')),
    [],
  );
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAnalyticsSessions(projectId, { limit: 25, direction });

  const sessions = useMemo(
    () => data?.pages.flatMap((p) => p.sessions) ?? [],
    [data],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Sessions" showFilterBar={false} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">
            Recent Sessions
          </CardTitle>
          <Button variant="outline" size="sm" onClick={toggleDirection}>
            {direction === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={sessions}
            isLoading={isLoading}
            disablePagination
            disableSorting
            onRowClick={(row) =>
              router.push(
                `/app/${orgId}/${projectId}/sessions/${row.sessionId}`,
              )
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
