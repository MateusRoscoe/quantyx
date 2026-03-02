'use client';

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { useOrganization } from '@/hooks/use-organizations';
import { useProject } from '@/hooks/use-projects';

function OrgName({ orgId }: { orgId: string }) {
  const { data } = useOrganization(orgId);
  return <>{data?.name ?? orgId}</>;
}

function ProjectName({ projectId }: { projectId: string }) {
  const { data } = useProject(projectId);
  return <>{data?.name ?? projectId}</>;
}

function formatSegment(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

interface BreadcrumbSegment {
  label: React.ReactNode;
  href: string;
}

function buildSegments(
  pathname: string,
  params: Record<string, string>
): BreadcrumbSegment[] {
  const validSegments = ['organizations', 'members'];
  const parts = pathname.split('/').filter(Boolean);
  const segments: BreadcrumbSegment[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const href = '/' + parts.slice(0, i + 1).join('/');

    if (part === params.orgId) {
      segments.push({
        label: <OrgName orgId={part} />,
        href,
      });
    } else if (part === params.projectId) {
      segments.push({
        label: <ProjectName projectId={part} />,
        href,
      });
    } else if (validSegments.includes(part)) {
      segments.push({
        label: formatSegment(part),
        href,
      });
    }
  }

  return segments;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const params = useParams<{ orgId?: string; projectId?: string }>();

  if (pathname === '/dashboard') return null;

  const segments = buildSegments(pathname, {
    orgId: params.orgId ?? '',
    projectId: params.projectId ?? '',
  });

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <Fragment key={segment.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href}>{segment.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
