'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OrgSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const base = `/app/${orgId}/settings`;

  const currentTab = pathname.endsWith('/members') ? 'members' : 'general';

  return (
    <div className="mx-auto max-w-screen-xl space-y-6">
      <Link
        href={`/app/${orgId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <h1 className="font-display text-2xl font-bold">Organization Settings</h1>

      <Tabs value={currentTab}>
        <TabsList>
          <TabsTrigger value="general" asChild>
            <Link href={base}>General</Link>
          </TabsTrigger>
          <TabsTrigger value="members" asChild>
            <Link href={`${base}/members`}>Members</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {children}
    </div>
  );
}
