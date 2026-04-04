'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProjectSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId, projectId } = useParams<{
    orgId: string;
    projectId: string;
  }>();
  const pathname = usePathname();
  const base = `/app/${orgId}/${projectId}/settings`;

  const currentTab =
    pathname === base
      ? 'general'
      : pathname.endsWith('/api-keys')
        ? 'api-keys'
        : pathname.endsWith('/setup')
          ? 'setup'
          : 'general';

  return (
    <div className="mx-auto max-w-screen-xl space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="font-display text-2xl font-bold">Project Settings</h1>

      <Tabs value={currentTab}>
        <TabsList>
          <TabsTrigger value="general" asChild>
            <Link href={base}>General</Link>
          </TabsTrigger>
          <TabsTrigger value="api-keys" asChild>
            <Link href={`${base}/api-keys`}>API Keys</Link>
          </TabsTrigger>
          <TabsTrigger value="setup" asChild>
            <Link href={`${base}/setup`}>SDK Setup</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {children}
    </div>
  );
}
