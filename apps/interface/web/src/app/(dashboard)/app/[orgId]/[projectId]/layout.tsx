'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { setLastVisitedProject } from '@/lib/last-project';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();

  useEffect(() => {
    if (orgId && projectId) {
      setLastVisitedProject(orgId, projectId);
    }
  }, [orgId, projectId]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      {children}
    </div>
  );
}
