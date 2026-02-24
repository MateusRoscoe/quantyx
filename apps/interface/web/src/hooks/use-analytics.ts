'use client';

import { useCallback, useContext, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QuantyxContext } from '@quantyx/react-sdk/react';
import type { EventProperties } from '@quantyx/react-sdk';

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
export function useAnalyticsIdentify(): (userId: string) => void {
  const client = useContext(QuantyxContext);
  return useCallback(
    (userId: string) => {
      client?.identify(userId);
    },
    [client],
  );
}

/**
 * Fires a `page_view` event on every pathname change.
 * No-ops gracefully when the SDK is not configured.
 */
export function usePageView() {
  const track = useAnalyticsTrack();
  const pathname = usePathname();

  useEffect(() => {
    track('page_view', {
      props_str: { path: pathname },
    });
  }, [pathname, track]);
}
