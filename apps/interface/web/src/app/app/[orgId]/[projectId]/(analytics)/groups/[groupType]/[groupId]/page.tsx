'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useGroupDetail, useGroupMembers } from '@/hooks/use-analytics-groups';
import {
  DataTable,
  DateTimeCell,
  TruncateWithTooltip,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface MemberRow {
  userId: string;
  assignedAt: string;
}

function useMemberColumns() {
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();

  const columns: ColumnDef<MemberRow, unknown>[] = [
    {
      accessorKey: 'userId',
      header: 'User ID',
      cell: (info) => {
        const id = info.getValue() as string;
        return (
          <TruncateWithTooltip tooltip={id} className="font-mono text-xs">
            <Link
              href={`/app/${orgId}/${projectId}/users/${id}`}
              className="font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {id}
            </Link>
          </TruncateWithTooltip>
        );
      },
    },
    { accessorKey: 'assignedAt', header: 'Assigned At', cell: DateTimeCell },
  ];

  return columns;
}

export default function GroupDetailPage() {
  const {
    orgId,
    projectId,
    groupType: rawGroupType,
    groupId: rawGroupId,
  } = useParams<{
    orgId: string;
    projectId: string;
    groupType: string;
    groupId: string;
  }>();

  const groupType = decodeURIComponent(rawGroupType);
  const groupId = decodeURIComponent(rawGroupId);

  const memberColumns = useMemberColumns();
  const { data: group, isLoading: groupLoading } = useGroupDetail(
    projectId,
    groupType,
    groupId,
  );
  const {
    data: membersData,
    isLoading: membersLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGroupMembers(projectId, groupType, groupId, { limit: 25 });

  const members = useMemo(
    () => membersData?.pages.flatMap((p) => p.users) ?? [],
    [membersData],
  );

  const properties = group?.properties ?? {};
  const hasProperties = Object.keys(properties).length > 0;
  const serverProperties = group?.serverProperties ?? {};
  const hasServerProperties = Object.keys(serverProperties).length > 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/groups`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to groups
      </Link>

      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <Badge variant="secondary" className="text-sm">
          {groupType}
        </Badge>
        <span className="font-mono">{groupId}</span>
      </h1>

      {/* Stats */}
      {groupLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : group ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              First seen
            </div>
            <p className="mt-1 text-sm font-medium">
              {new Date(group.firstSeen).toLocaleString()}
            </p>
          </Card>
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last seen
            </div>
            <p className="mt-1 text-sm font-medium">
              {new Date(group.lastSeen).toLocaleString()}
            </p>
          </Card>
        </div>
      ) : (
        <Card className="gap-0 p-4">
          <p className="text-sm text-muted-foreground">Group not found.</p>
        </Card>
      )}

      {/* Properties */}
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

      {/* Server Properties */}
      {hasServerProperties && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Server Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(serverProperties).map(([key, value]) => (
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

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={memberColumns}
            data={members}
            isLoading={membersLoading}
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
