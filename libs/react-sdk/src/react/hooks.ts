import { useCallback, useContext } from 'react';
import { QuantyxContext } from './provider.js';
import type { QuantyxClient } from '../client.js';
import type { EventProperties } from '../types.js';

function useQuantyxClient(): QuantyxClient {
  const client = useContext(QuantyxContext);
  if (!client) {
    throw new Error('useQuantyx must be used within a <QuantyxProvider>');
  }
  return client;
}

/** Access the raw QuantyxClient instance. */
export function useQuantyx(): QuantyxClient {
  return useQuantyxClient();
}

/** Returns a stable `track` function. */
export function useTrack(): (eventName: string, properties?: EventProperties) => void {
  const client = useQuantyxClient();
  return useCallback(
    (eventName: string, properties?: EventProperties) => {
      client.track(eventName, properties);
    },
    [client],
  );
}

/** Returns a stable `identify` function. */
export function useIdentify(): (userId: string) => void {
  const client = useQuantyxClient();
  return useCallback(
    (userId: string) => {
      client.identify(userId);
    },
    [client],
  );
}
