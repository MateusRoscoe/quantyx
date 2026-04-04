'use client';

import {
  useParams,
  useSearchParams,
  useRouter,
  usePathname,
} from 'next/navigation';
import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/dashboard';
import { EventsAnalyticsView } from './_components/events-analytics-view';
import { EventExplorerView } from './_components/event-explorer-view';

export default function EventsPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = searchParams.get('view') ?? 'analytics';

  const setView = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'analytics') {
        params.delete('view');
      } else {
        params.set('view', value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Events" />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="explorer">Event Explorer</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6">
          <EventsAnalyticsView projectId={projectId} />
        </TabsContent>

        <TabsContent value="explorer" className="mt-6">
          <EventExplorerView projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
