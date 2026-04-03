'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizations } from '@/hooks/use-organizations';
import { useProjects } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { getLastVisitedProject } from '@/lib/last-project';

export default function AppRedirectPage() {
  const router = useRouter();
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();

  // If user has exactly 1 org, try to auto-select its project
  const singleOrg = orgs?.length === 1 ? orgs[0] : null;
  const { data: projects, isLoading: projectsLoading } = useProjects(
    singleOrg?.id ?? '',
  );

  useEffect(() => {
    if (orgsLoading) return;

    if (!orgs || orgs.length === 0) {
      router.replace('/onboarding');
      return;
    }

    // Try last-visited project
    const last = getLastVisitedProject();
    if (last) {
      const orgExists = orgs.some((o) => o.id === last.orgId);
      if (orgExists) {
        router.replace(`/app/${last.orgId}/${last.projectId}`);
        return;
      }
    }

    if (singleOrg && !projectsLoading) {
      if (projects?.length === 1) {
        router.replace(`/app/${singleOrg.id}/${projects[0].id}`);
        return;
      }
      if (projects && projects.length > 1) {
        router.replace(`/app/${singleOrg.id}`);
        return;
      }
      if (projects?.length === 0) {
        router.replace(`/app/${singleOrg.id}`);
        return;
      }
    }

    if (!singleOrg) {
      router.replace('/app/organizations');
    }
  }, [orgs, orgsLoading, projects, projectsLoading, singleOrg, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}
