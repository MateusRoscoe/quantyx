import type { QuantyxConfig, EventProperties, EventPayload, DeviceContext } from './types.js';
import { generateUUIDv7 } from './utils/uuid.js';
import { getSessionId } from './utils/session.js';
import { detectDevice } from './utils/detect.js';

const DEFAULT_FLUSH_INTERVAL = 5_000;
const DEFAULT_MAX_BATCH_SIZE = 20;

export class QuantyxClient {
  private readonly config: Required<QuantyxConfig>;
  private queue: EventPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private userId = '';
  private sessionId: string;
  private deviceContext: DeviceContext;
  private running = false;

  constructor(config: QuantyxConfig) {
    this.config = {
      flushInterval: DEFAULT_FLUSH_INTERVAL,
      maxBatchSize: DEFAULT_MAX_BATCH_SIZE,
      autoDetect: true,
      ...config,
    };

    this.sessionId = getSessionId();
    this.deviceContext = this.config.autoDetect ? detectDevice() : { platform: 'web' as const };

    this.start();
  }

  /** Set the user ID for all subsequent events. */
  identify(userId: string): void {
    this.userId = userId;
  }

  /** Queue an event for batching. */
  track(eventName: string, properties?: EventProperties): void {
    const now = new Date();

    const payload: EventPayload = {
      event_id: generateUUIDv7(),
      session_id: this.sessionId,
      user_id: this.userId,
      event_name: eventName,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      ...(this.config.autoDetect ? this.deviceContext : {}),
      ...properties,
    };

    this.queue.push(payload);

    if (this.queue.length >= this.config.maxBatchSize) {
      void this.flush();
    }
  }

  /** Force-flush the queue. */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const url = `${this.config.endpoint}/ingest-bulk`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    };
    const body = JSON.stringify(batch);

    try {
      await fetch(url, { method: 'POST', headers, body, keepalive: true });
    } catch {
      // Silently drop on network failure — events are best-effort
    }
  }

  /** Stop the flush timer and flush remaining events. */
  async shutdown(): Promise<void> {
    this.removeListeners();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    await this.flush();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(() => void this.flush(), this.config.flushInterval);
    this.addListeners();
  }

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.sendBeacon();
    }
  };

  private handlePageHide = (): void => {
    this.sendBeacon();
  };

  private addListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide);
    }
  }

  private removeListeners(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide);
    }
  }

  /** Use sendBeacon for reliable delivery during page unload. Falls back to sync flush. */
  private sendBeacon(): void {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const url = `${this.config.endpoint}/ingest-bulk`;
    const body = JSON.stringify(batch);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(`${url}?apiKey=${this.config.apiKey}`, blob);
      if (!sent) {
        // sendBeacon failed, try fetch with keepalive as fallback
        try {
          void fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
            body,
            keepalive: true,
          });
        } catch {
          // Best-effort delivery
        }
      }
    } else {
      try {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
          body,
          keepalive: true,
        });
      } catch {
        // Best-effort delivery
      }
    }
  }
}
