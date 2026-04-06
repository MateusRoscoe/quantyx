import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/analytics-api';

// ── List ────────────────────────────────────────────────────────────────────

interface GroupListItem {
  groupType: string;
  groupId: string;
  name: string | null;
  firstSeen: string;
  lastSeen: string;
}

interface GroupsListData {
  groups: GroupListItem[];
  nextCursor: string | null;
}

export type { GroupListItem };

export function useAnalyticsGroups(
  projectId: string,
  opts?: { groupType?: string; limit?: number },
) {
  const limit = opts?.limit ?? 50;
  const groupType = opts?.groupType;

  return useInfiniteQuery({
    queryKey: ['analytics', 'groups', projectId, groupType, limit],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<GroupsListData>(`/projects/${projectId}/groups`, {
        limit: String(limit),
        ...(groupType && { group_type: groupType }),
        ...(pageParam && { cursor: pageParam }),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!projectId,
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

interface GroupDetail {
  groupType: string;
  groupId: string;
  firstSeen: string;
  lastSeen: string;
  properties: Record<string, string | number | boolean>;
  serverProperties: Record<string, string | number | boolean>;
}

export function useGroupDetail(
  projectId: string,
  groupType: string,
  groupId: string,
) {
  return useQuery({
    queryKey: ['analytics', 'group', projectId, groupType, groupId],
    queryFn: () =>
      analyticsApi.get<GroupDetail>(
        `/projects/${projectId}/groups/${encodeURIComponent(groupType)}/${encodeURIComponent(groupId)}`,
      ),
    enabled: !!projectId && !!groupType && !!groupId,
  });
}

// ── Members ─────────────────────────────────────────────────────────────────

interface GroupMember {
  userId: string;
  assignedAt: string;
}

interface GroupMembersData {
  users: GroupMember[];
  nextCursor: string | null;
}

export function useGroupMembers(
  projectId: string,
  groupType: string,
  groupId: string,
  opts?: { limit?: number },
) {
  const limit = opts?.limit ?? 50;

  return useInfiniteQuery({
    queryKey: [
      'analytics',
      'group-members',
      projectId,
      groupType,
      groupId,
      limit,
    ],
    queryFn: ({ pageParam }) =>
      analyticsApi.get<GroupMembersData>(
        `/projects/${projectId}/groups/${encodeURIComponent(groupType)}/${encodeURIComponent(groupId)}/users`,
        {
          limit: String(limit),
          ...(pageParam && { cursor: pageParam }),
        },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!projectId && !!groupType && !!groupId,
  });
}

// ── User's groups ───────────────────────────────────────────────────────────

interface UserGroupMembership {
  groupType: string;
  groupId: string;
  assignedAt: string;
}

interface UserGroupsData {
  groups: UserGroupMembership[];
}

export type { UserGroupMembership };

export function useUserGroups(projectId: string, userId: string) {
  return useQuery({
    queryKey: ['analytics', 'user-groups', projectId, userId],
    queryFn: () =>
      analyticsApi.get<UserGroupsData>(
        `/projects/${projectId}/users/${userId}/groups`,
      ),
    enabled: !!projectId && !!userId,
  });
}
