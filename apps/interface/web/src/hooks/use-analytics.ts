'use client';

import { useCallback, useContext, useEffect, useMemo } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { QuantyxContext } from '@quantyx/react-sdk/react';
import type {
  EventProperties,
  UserTraits,
  GroupTraits,
} from '@quantyx/react-sdk';

/**
 * Returns a safe `track` function that no-ops when QuantyxProvider is absent.
 */
export function useAnalyticsTrack(): (
  eventName: string,
  properties?: EventProperties,
) => void {
  const client = useContext(QuantyxContext);
  return useCallback(
    (eventName: string, properties?: EventProperties) => {
      client?.track(eventName, properties);
    },
    [client],
  );
}

/**
 * Returns a safe `identify` function that no-ops when QuantyxProvider is absent.
 */
export function useAnalyticsIdentify(): (
  userId: string,
  traits?: UserTraits,
) => void {
  const client = useContext(QuantyxContext);
  return useCallback(
    (userId: string, traits?: UserTraits) => {
      client?.identify(userId, traits);
    },
    [client],
  );
}

/**
 * Returns a safe `group` function that no-ops when QuantyxProvider is absent.
 */
export function useAnalyticsGroup(): (
  groupType: string,
  groupId: string,
  traits?: GroupTraits,
) => void {
  const client = useContext(QuantyxContext);
  return useCallback(
    (groupType: string, groupId: string, traits?: GroupTraits) => {
      client?.group(groupType, groupId, traits);
    },
    [client],
  );
}

/**
 * Returns the pathname with dynamic param values replaced by their names.
 * e.g. /organizations/019ca701-df58-72c0-8dd4-43cd5ef0cbe3 → /organizations/:orgId
 */
export function useRoutePattern(): string {
  const pathname = usePathname();
  const params = useParams();
  return useMemo(() => {
    let route = pathname;
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        route = route.replace(value, `:${name}`);
      }
    }
    return route;
  }, [pathname, params]);
}

/**
 * Fires a `page_view` event on every pathname change.
 * No-ops gracefully when the SDK is not configured.
 */
export function usePageView() {
  const track = useAnalyticsTrack();
  const path = useRoutePattern();

  useEffect(() => {
    track('page_view', {
      props_str: { path },
    });
  }, [path, track]);
}
