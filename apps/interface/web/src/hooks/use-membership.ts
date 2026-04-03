'use client';

import { useMemo } from 'react';
import { useMembers } from './use-members';
import { useSession } from '@/lib/auth-client';

export function useMembership(orgId: string) {
  const { data: members, isLoading: membersLoading } = useMembers(orgId);
  const { data: session } = useSession();

  return useMemo(() => {
    if (membersLoading || !members || !session?.user?.id) {
      return { role: null, isOwner: false, isAdmin: false, isMember: false, isLoading: true };
    }

    const currentMember = members.find(
      (m) => m.userId === session.user.id,
    );

    if (!currentMember) {
      return { role: null, isOwner: false, isAdmin: false, isMember: false, isLoading: false };
    }

    const role = currentMember.role;
    return {
      role,
      isOwner: role === 'owner',
      isAdmin: role === 'admin' || role === 'owner',
      isMember: true,
      isLoading: false,
    };
  }, [members, membersLoading, session?.user?.id]);
}
