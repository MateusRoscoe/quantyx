import { useCallback, useContext } from 'react';
import { QuantyxContext } from './provider.js';
import type { QuantyxClient } from '../client.js';
import type {
  EventProperties,
  UserTraits,
  GroupTraits,
  SessionProperties,
} from '../types.js';

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
export function useTrack(): (
  eventName: string,
  properties?: EventProperties,
) => void {
  const client = useQuantyxClient();
  return useCallback(
    (eventName: string, properties?: EventProperties) => {
      client.track(eventName, properties);
    },
    [client],
  );
}

/** Returns a stable `identify` function. Optionally sends user traits via $identify event. */
export function useIdentify(): (userId: string, traits?: UserTraits) => void {
  const client = useQuantyxClient();
  return useCallback(
    (userId: string, traits?: UserTraits) => {
      client.identify(userId, traits);
    },
    [client],
  );
}

/** Returns a stable `group` function for setting group membership and traits. */
export function useGroup(): (
  groupType: string,
  groupId: string,
  traits?: GroupTraits,
) => void {
  const client = useQuantyxClient();
  return useCallback(
    (groupType: string, groupId: string, traits?: GroupTraits) => {
      client.group(groupType, groupId, traits);
    },
    [client],
  );
}

/** Returns a stable `setSessionProperties` function for setting session-level properties. */
export function useSetSessionProperties(): (
  properties: SessionProperties,
) => void {
  const client = useQuantyxClient();
  return useCallback(
    (properties: SessionProperties) => {
      client.setSessionProperties(properties);
    },
    [client],
  );
}
