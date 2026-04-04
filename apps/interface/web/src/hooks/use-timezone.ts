'use client';

import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'quantyx:timezone';
const listeners = new Set<() => void>();

function getSnapshot(): string {
  if (typeof window === 'undefined') return 'UTC';
  return (
    localStorage.getItem(STORAGE_KEY) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

function getServerSnapshot(): string {
  return 'UTC';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) listener();
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

export function useTimezone() {
  const timezone = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setTimezone = useCallback((tz: string) => {
    localStorage.setItem(STORAGE_KEY, tz);
    notify();
  }, []);

  const resetTimezone = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    notify();
  }, []);

  // Short abbreviation for display (e.g., "EDT", "BRT")
  const abbreviation =
    new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? timezone;

  return { timezone, abbreviation, setTimezone, resetTimezone };
}
