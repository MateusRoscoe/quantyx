'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSessionDetail } from '@/hooks/use-analytics-sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function SessionDetailPage() {
  const { orgId, projectId, sessionId } = useParams<{
    orgId: string;
    projectId: string;
    sessionId: string;
  }>();

  const { data, isLoading } = useSessionDetail(projectId, sessionId);
  const events = data?.events ?? [];

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/sessions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <h1 className="font-display text-2xl font-bold">
        Session <span className="font-mono">{sessionId.slice(0, 12)}...</span>
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Event Timeline ({events.length} events)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No events found for this session
            </p>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute top-3 bottom-3 left-[15px] w-px bg-border" />

              {events.map((event, i) => (
                <div key={event.event_id} className="relative flex gap-4 py-2.5">
                  {/* Dot */}
                  <div className="relative z-10 mt-1 flex h-[9px] w-[9px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background" style={{ marginLeft: '11px' }} />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-medium">
                        {event.event_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {event.props_str && event.props_str !== '{}' && (
                      <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                        {typeof event.props_str === 'string'
                          ? event.props_str
                          : JSON.stringify(event.props_str, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Index */}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/50">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
