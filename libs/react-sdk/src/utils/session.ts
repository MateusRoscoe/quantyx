import { generateUUIDv4 } from './uuid.js';

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

    const id = generateUUIDv4();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage unavailable (SSR, privacy mode, etc.)
    if (!memorySessionId) {
      memorySessionId = generateUUIDv4();
    }
    return memorySessionId;
  }
}
