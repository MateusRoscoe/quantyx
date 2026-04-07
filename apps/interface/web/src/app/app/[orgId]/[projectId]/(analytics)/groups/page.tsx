'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useParams,
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAnalyticsGroups } from '@/hooks/use-analytics-groups';
import {
  DataTable,
  PageHeader,
  MonoCell,
  DateTimeCell,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from '@tanstack/react-table';

interface GroupRow {
  groupType: string;
  groupId: string;
  name: string | null;
  firstSeen: string;
  lastSeen: string;
}

const columns: ColumnDef<GroupRow, unknown>[] = [
  {
    accessorKey: 'groupType',
    header: 'Type',
    size: 120,
    cell: (info) => (
      <Badge variant="secondary">{info.getValue() as string}</Badge>
    ),
  },
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
  { accessorKey: 'groupId', header: 'Group ID', cell: MonoCell },
  { accessorKey: 'firstSeen', header: 'First Seen', cell: DateTimeCell },
  { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateTimeCell },
];

export default function GroupsPage() {
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const groupTypeFilter = searchParams.get('group_type') ?? undefined;

  const setGroupTypeFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete('group_type');
      } else {
        params.set('group_type', value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAnalyticsGroups(projectId, { groupType: groupTypeFilter, limit: 25 });

  const groups = useMemo(
    () => data?.pages.flatMap((p) => p.groups) ?? [],
    [data],
  );

  const knownTypes = useMemo(() => {
    const types = new Set(groups.map((g) => g.groupType));
    return [...types].sort();
  }, [groups]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="space-y-6">
      <PageHeader title="Groups" showFilterBar={false} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Groups</CardTitle>
            {knownTypes.length > 1 && (
              <Select
                value={groupTypeFilter ?? 'all'}
                onValueChange={setGroupTypeFilter}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {knownTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={groups}
            isLoading={isLoading}
            disablePagination
            disableSorting
            onRowClick={(row) =>
              router.push(
                `/app/${orgId}/${projectId}/groups/${encodeURIComponent(row.groupType)}/${encodeURIComponent(row.groupId)}`,
              )
            }
          />
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
