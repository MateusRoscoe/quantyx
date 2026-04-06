'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEventsFeed, type RawEvent } from '@/hooks/use-events-feed';
import { useFilters } from '@/hooks/use-filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BrowserIcon, OsIcon, DeviceIcon } from '@/lib/dimension-icons';
import { countryToFlag, countryName } from '@/lib/country';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function EventRow({
  event,
  orgId,
  projectId,
}: {
  event: RawEvent;
  orgId: string;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const propsCount =
    Object.keys(event.props_str ?? {}).length +
    Object.keys(event.props_num ?? {}).length +
    Object.keys(event.props_bool ?? {}).length;

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <span className="w-40 shrink-0 text-xs tabular-nums text-muted-foreground">
          {new Date(event.timestamp).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>

        <span className="min-w-0 shrink-0 font-mono text-sm font-medium">
          {event.event_name}
        </span>

        {event.path && (
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {event.path}
          </span>
        )}

        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {propsCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {propsCount} prop{propsCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {event.user_id && (
            <span className="hidden font-mono sm:inline" title={event.user_id}>
              {event.user_id.slice(0, 8)}...
            </span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t bg-card px-4 py-3 space-y-3">
          {/* Identifiers */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            {event.path && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Path: </span>
                <span className="font-mono">{event.path}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">User: </span>
              {event.user_id ? (
                <Link
                  href={`/app/${orgId}/${projectId}/users/${event.user_id}`}
                  className="font-mono underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {event.user_id}
                </Link>
              ) : (
                <span className="text-muted-foreground">(anonymous)</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Session: </span>
              {event.session_id ? (
                <Link
                  href={`/app/${orgId}/${projectId}/sessions/${event.session_id}`}
                  className="font-mono underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {event.session_id}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div className="flex flex-wrap gap-1.5">
            {event.browser && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <BrowserIcon browser={event.browser} className="h-3 w-3" />
                {event.browser}
              </Badge>
            )}
            {event.os && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <OsIcon os={event.os} className="h-3 w-3" />
                {event.os}
              </Badge>
            )}
            {event.device_type && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <DeviceIcon deviceType={event.device_type} className="h-3 w-3" />
                {event.device_type}
              </Badge>
            )}
            {event.country && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    {countryToFlag(event.country) ?? event.country}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {countryName(event.country) ?? event.country}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Custom properties */}
          {propsCount > 0 && (
            <div className="rounded border bg-background p-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Properties
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 text-xs">
                {Object.entries(event.props_str ?? {}).map(([k, v]) => (
                  <div key={`str-${k}`}>
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
                {Object.entries(event.props_num ?? {}).map(([k, v]) => (
                  <div key={`num-${k}`}>
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
                {Object.entries(event.props_bool ?? {}).map(([k, v]) => (
                  <div key={`bool-${k}`}>
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-mono">
                      {v === 1 ? 'true' : 'false'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EventExplorerView({ projectId }: { projectId: string }) {
  const { orgId } = useParams<{ orgId: string }>();
  const { filterParams } = useFilters();
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useEventsFeed(projectId, { direction, filters: filterParams });

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  // Infinite scroll sentinel
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
    setDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length > 0
            ? `Showing ${events.length} event${events.length !== 1 ? 's' : ''}`
            : ''}
        </p>
        <Button variant="outline" size="sm" onClick={toggleDirection}>
          {direction === 'desc' ? 'Newest first' : 'Oldest first'}
        </Button>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border-b px-4 py-2.5 last:border-b-0">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No events found for the selected filters and date range
          </p>
        ) : (
          <>
            {events.map((event) => (
              <EventRow
                key={event.event_id}
                event={event}
                orgId={orgId}
                projectId={projectId}
              />
            ))}

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
          </>
        )}
      </div>
    </div>
  );
}
