'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useParams,
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useAnalyticsGroups } from '@/hooks/use-analytics-groups';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  DataTable,
  PageHeader,
  MonoCell,
  NumberCell,
  DateTimeCell,
} from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  memberCount: number;
  firstSeen: string;
  lastSeen: string;
}

const TYPE_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
];

function buildColumns(
  typeColorMap: Map<string, string>,
): ColumnDef<GroupRow, unknown>[] {
  return [
    {
      accessorKey: 'groupType',
      header: 'Type',
      size: 120,
      cell: (info) => {
        const type = info.getValue() as string;
        return (
          <Badge variant="secondary" className={typeColorMap.get(type)}>
            {type}
          </Badge>
        );
      },
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
    { accessorKey: 'memberCount', header: 'Members', cell: NumberCell },
    { accessorKey: 'firstSeen', header: 'First Seen', cell: DateTimeCell },
    { accessorKey: 'lastSeen', header: 'Last Seen', cell: DateTimeCell },
  ];
}

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

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 600);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAnalyticsGroups(projectId, {
      groupType: groupTypeFilter,
      search: debouncedSearch || undefined,
      limit: 25,
    });

  const groups = useMemo(
    () => data?.pages.flatMap((p) => p.groups) ?? [],
    [data],
  );

  const knownTypesRef = useRef(new Set<string>());
  const knownTypes = useMemo(() => {
    for (const g of groups) knownTypesRef.current.add(g.groupType);
    return [...knownTypesRef.current].sort();
  }, [groups]);

  const columns = useMemo(() => {
    const colorMap = new Map<string, string>();
    for (let i = 0; i < knownTypes.length; i++)
      colorMap.set(knownTypes[i], TYPE_COLORS[i % TYPE_COLORS.length]);
    return buildColumns(colorMap);
  }, [knownTypes]);

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
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {(knownTypes.length > 1 || groupTypeFilter) && (
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
