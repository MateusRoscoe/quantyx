import { generateUUIDv7 } from './uuid.js';

const SESSION_KEY = 'quantyx_session_id';
let memorySessionId: string | null = null;

/**
 * Get or create a session ID.
 * Persisted in sessionStorage (survives page refreshes, expires when tab closes).
 * Falls back to in-memory storage if sessionStorage is unavailable.
 */
export function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;

    const id = generateUUIDv7();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage unavailable (SSR, privacy mode, etc.)
    if (!memorySessionId) {
      memorySessionId = generateUUIDv7();
    }
    return memorySessionId;
  }
}

/** Replace the current session ID with a fresh one. */
export function resetSessionId(): string {
  const id = generateUUIDv7();
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    memorySessionId = id;
  }
  return id;
}
