'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAnalyticsUsers } from '@/hooks/use-analytics-users';
import { useAnalyticsSessions } from '@/hooks/use-analytics-sessions';
import { DataTable, DateTimeCell, NumberCell, CountryCell } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Clock, Zap } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface SessionRow {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalEvents: number;
  pageViews: number;
  browser: string;
  country: string;
}

function useSessionColumns() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();

  const columns: ColumnDef<SessionRow, unknown>[] = [
    {
      accessorKey: 'sessionId',
      header: 'Session',
      cell: (info) => {
        const id = info.getValue() as string;
        return (
          <Link
            href={`/app/${orgId}/${projectId}/sessions/${id}`}
            className="font-mono text-xs font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {id}
          </Link>
        );
      },
    },
    { accessorKey: 'startedAt', header: 'Started', cell: DateTimeCell },
    { accessorKey: 'endedAt', header: 'Last Event', cell: DateTimeCell },
    { accessorKey: 'totalEvents', header: 'Events', cell: NumberCell },
    { accessorKey: 'pageViews', header: 'Pages', cell: NumberCell },
    { accessorKey: 'browser', header: 'Browser' },
    { accessorKey: 'country', header: 'Country', cell: CountryCell },
  ];

  return columns;
}

export default function UserDetailPage() {
  const { orgId, projectId, userId } = useParams<{
    orgId: string;
    projectId: string;
    userId: string;
  }>();

  const sessionColumns = useSessionColumns();
  const { data: usersData, isLoading: usersLoading } = useAnalyticsUsers(projectId);
  const { data: sessionsData, isLoading: sessionsLoading } = useAnalyticsSessions(projectId);

  const user = usersData?.users?.find((u) => u.userId === userId);
  const userSessions = useMemo(
    () =>
      sessionsData?.pages
        .flatMap((p) => p.sessions)
        .filter((s) => s.userId === userId) ?? [],
    [sessionsData, userId],
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/users`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      <h1 className="font-display text-2xl font-bold font-mono">
        {userId}
      </h1>

      {/* User stats */}
      {usersLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : user ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              First seen
            </div>
            <p className="mt-1 text-sm font-medium">
              {new Date(user.firstSeen).toLocaleString()}
            </p>
          </Card>
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last seen
            </div>
            <p className="mt-1 text-sm font-medium">
              {new Date(user.lastSeen).toLocaleString()}
            </p>
          </Card>
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Total events
            </div>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              {user.totalEvents.toLocaleString()}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="gap-0 p-4">
          <p className="text-sm text-muted-foreground">User not found in the current date range.</p>
        </Card>
      )}

      {/* User sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={sessionColumns}
            data={userSessions}
            isLoading={sessionsLoading}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
