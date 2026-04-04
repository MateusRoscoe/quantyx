'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSessionDetail } from '@/hooks/use-analytics-sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Clock,
  Zap,
  FileText,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';
import { BrowserIcon, OsIcon, DeviceIcon } from '@/lib/dimension-icons';
import { countryToFlag, countryName } from '@/lib/country';

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function SessionDetailPage() {
  const { orgId, projectId, sessionId } = useParams<{
    orgId: string;
    projectId: string;
    sessionId: string;
  }>();

  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useSessionDetail(projectId, sessionId, { direction });

  const session = data?.pages[0]?.session ?? null;
  const events = data?.pages.flatMap((p) => p.events) ?? [];

  // Infinite scroll: observe the sentinel at the bottom
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

  const toggleDirection = useCallback(() => {
    setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgId}/${projectId}/sessions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <h1 className="font-mono text-2xl font-bold">{sessionId}</h1>

      {/* Session metadata */}
      {session ? (
        <div className="space-y-4">
          {/* User — full width, clickable */}
          <Card className="gap-0 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              User
            </div>
            {session.userId ? (
              <Link
                href={`/app/${orgId}/${projectId}/users/${session.userId}`}
                className="mt-1 block font-mono text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                {session.userId}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                (anonymous)
              </p>
            )}
          </Card>

          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              {
                icon: Calendar,
                label: 'Started at',
                value: formatDateTime(session.startedAt),
              },
              {
                icon: Clock,
                label: 'Duration',
                value: formatDuration(session.startedAt, session.endedAt),
              },
              {
                icon: Zap,
                label: 'Events',
                value: session.totalEvents.toLocaleString(),
              },
              {
                icon: FileText,
                label: 'Pages',
                value: session.pageViews.toLocaleString(),
              },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="gap-0 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <p className="mt-1 font-mono text-sm font-medium">{value}</p>
              </Card>
            ))}
          </div>

          {/* Environment */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="gap-0 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Browser
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {session.browser ? (
                  <>
                    <BrowserIcon
                      browser={session.browser}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    {session.browser}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </Card>

            <Card className="gap-0 p-4">
              <p className="text-xs font-medium text-muted-foreground">OS</p>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {session.os ? (
                  <>
                    <OsIcon
                      os={session.os}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    {session.os}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </Card>

            <Card className="gap-0 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Device
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {session.deviceType ? (
                  <>
                    <DeviceIcon
                      deviceType={session.deviceType}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    {session.deviceType}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </Card>

            <Card className="gap-0 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Country
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {session.country ? (
                  <>
                    <span>{countryToFlag(session.country)}</span>
                    {countryName(session.country) ?? session.country}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`s${i}`} className="h-16" />
            ))}
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`e${i}`} className="h-16" />
            ))}
          </div>
        </div>
      )}

      {/* Event timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Event Timeline
            {session ? ` (${session.totalEvents.toLocaleString()} total)` : ''}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={toggleDirection}>
            {direction === 'asc' ? 'Oldest first' : 'Newest first'}
          </Button>
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
              <div className="absolute top-3 bottom-3 left-[15px] w-px bg-border" />

              {events.map((event, i) => (
                <div
                  key={event.event_id}
                  className="relative flex gap-4 py-2.5"
                >
                  <div
                    className="relative z-10 mt-1 flex h-[9px] w-[9px] shrink-0 rounded-full border-2 border-primary bg-background"
                    style={{ marginLeft: '11px' }}
                  />
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
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/50">
                    #
                    {direction === 'asc'
                      ? i + 1
                      : session
                        ? session.totalEvents - i
                        : i + 1}
                  </span>
                </div>
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-1" />

              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!hasNextPage && events.length > 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  All events loaded
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
