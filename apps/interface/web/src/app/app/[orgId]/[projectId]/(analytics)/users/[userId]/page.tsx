'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAnalyticsUser } from '@/hooks/use-analytics-users';
import { useAnalyticsSessions } from '@/hooks/use-analytics-sessions';
import { useDateRange } from '@/hooks/use-date-range';
import {
  DataTable,
  DateTimeCell,
  NumberCell,
  BrowserCell,
  CountryCell,
  TruncateWithTooltip,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Zap,
  Hash,
  Activity,
} from 'lucide-react';
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
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();

  const columns: ColumnDef<SessionRow, unknown>[] = [
    {
      accessorKey: 'sessionId',
      header: 'Session',
      size: 180,
      cell: (info) => {
        const id = info.getValue() as string;
        return (
          <TruncateWithTooltip tooltip={id} className="font-mono text-xs">
            <Link
              href={`/app/${orgId}/${projectId}/sessions/${id}`}
              className="font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {id}
            </Link>
          </TruncateWithTooltip>
        );
      },
    },
    { accessorKey: 'startedAt', header: 'Started', cell: DateTimeCell },
    { accessorKey: 'endedAt', header: 'Last Event', cell: DateTimeCell },
    {
      accessorKey: 'totalEvents',
      header: 'Events',
      cell: NumberCell,
      size: 80,
    },
    {
      accessorKey: 'pageViews',
      header: 'Pages',
      cell: NumberCell,
      size: 80,
    },
    {
      accessorKey: 'browser',
      header: 'Browser',
      cell: BrowserCell,
      size: 120,
    },
    { accessorKey: 'country', header: 'Country', cell: CountryCell, size: 60 },
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
  const { from, to } = useDateRange();
  const { data: user, isLoading: userLoading } =
    useAnalyticsUser(projectId, userId);
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAnalyticsSessions(projectId, { userId, limit: 25 });

  const userSessions = useMemo(
    () => sessionsData?.pages.flatMap((p) => p.sessions) ?? [],
    [sessionsData],
  );

  const sessionStats = useMemo(() => {
    if (userSessions.length === 0) return null;
    const totalEvents = userSessions.reduce(
      (sum, s) => sum + s.totalEvents,
      0,
    );
    return {
      count: userSessions.length,
      avgEvents: Math.round(totalEvents / userSessions.length),
    };
  }, [userSessions]);

  const properties = user?.properties ?? {};
  const hasProperties = Object.keys(properties).length > 0;

  const dateLabel = `${from.toLocaleDateString()} — ${to.toLocaleDateString()}`;

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/users`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      <h1 className="font-display text-2xl font-bold font-mono">{userId}</h1>

      {/* User stats */}
      {userLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : user ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
          {sessionStats && (
            <>
              <Card className="gap-0 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  Sessions loaded
                </div>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {sessionStats.count.toLocaleString()}
                </p>
              </Card>
              <Card className="gap-0 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  Avg events/session
                </div>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {sessionStats.avgEvents.toLocaleString()}
                </p>
              </Card>
            </>
          )}
        </div>
      ) : (
        <Card className="gap-0 p-4">
          <p className="text-sm text-muted-foreground">User not found.</p>
        </Card>
      )}

      {/* User properties */}
      {hasProperties && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {key}
                  </dt>
                  <dd className="mt-0.5 truncate font-mono text-sm">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* User sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Sessions</CardTitle>
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={sessionColumns}
            data={userSessions}
            isLoading={sessionsLoading}
            disablePagination
            disableSorting
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
