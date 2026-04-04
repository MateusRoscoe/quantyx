/**
 * Seed script — generates realistic mock analytics events and sends them
 * to the api-event-webhook `/ingest-bulk` endpoint in configurable batches.
 *
 * Usage:
 *   npx tsx scripts/seed-events.ts --api-key <key> [options]
 *
 * Options:
 *   --api-key       Required. The X-API-Key for the target project.
 *   --endpoint      API base URL (default: http://localhost:3002)
 *   --total         Total events to generate (default: 100_000)
 *   --batch-size    Events per HTTP request (default: 500)
 *   --concurrency   Parallel in-flight requests (default: 5)
 *   --days-back     How many days of history to generate (default: 90)
 */

import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

// ── CLI args ────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    'api-key': { type: 'string' },
    endpoint: { type: 'string', default: 'http://localhost:3002' },
    total: { type: 'string', default: '10000000' },
    'batch-size': { type: 'string', default: '1000' },
    concurrency: { type: 'string', default: '10' },
    'days-back': { type: 'string', default: '90' },
  },
  strict: true,
});

const API_KEY = values['api-key'];
if (!API_KEY) {
  console.error('Error: --api-key is required');
  process.exit(1);
}

const ENDPOINT = values['endpoint']!;
const TOTAL = parseInt(values['total']!, 10);
const BATCH_SIZE = parseInt(values['batch-size']!, 10);
const CONCURRENCY = parseInt(values['concurrency']!, 10);
const DAYS_BACK = parseInt(values['days-back']!, 10);

// ── UUIDv7 generation (adapted from libs/react-sdk/src/utils/uuid.ts) ───────

function uuidv7(timestampMs: number): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-bit timestamp (big-endian) in bytes 0-5
  bytes[0] = (timestampMs / 2 ** 40) & 0xff;
  bytes[1] = (timestampMs / 2 ** 32) & 0xff;
  bytes[2] = (timestampMs / 2 ** 24) & 0xff;
  bytes[3] = (timestampMs / 2 ** 16) & 0xff;
  bytes[4] = (timestampMs / 2 ** 8) & 0xff;
  bytes[5] = timestampMs & 0xff;

  // Version 7: set bits 6[7:4] = 0111
  bytes[6] = 0x70 | (bytes[6] & 0x0f);

  // Variant 10xx: set bits 8[7:6] = 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── Realistic data pools ────────────────────────────────────────────────────

const EVENT_NAMES = [
  'page_view',
  'page_view',
  'page_view',
  'page_view', // weighted: ~40% page views
  'click',
  'click',
  'form_submit',
  'sign_up',
  'login',
  'add_to_cart',
  'purchase',
  'search',
  'scroll_depth',
  'video_play',
];

const PAGES = [
  '/',
  '/pricing',
  '/about',
  '/docs',
  '/docs/getting-started',
  '/docs/api-reference',
  '/docs/sdk',
  '/blog',
  '/blog/launch-announcement',
  '/blog/analytics-guide',
  '/dashboard',
  '/dashboard/settings',
  '/dashboard/events',
  '/signup',
  '/login',
  '/contact',
  '/features',
  '/integrations',
];

// Device profiles — couples device type, browser, OS, and platform realistically
type DeviceProfile = {
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  platform: string;
};

const BROWSER_VERSIONS: Record<string, string[]> = {
  Chrome: ['120.0', '121.0', '122.0', '123.0', '124.0', '125.0'],
  Firefox: ['121.0', '122.0', '123.0', '124.0'],
  Safari: ['17.2', '17.3', '17.4', '17.5'],
  Edge: ['120.0', '121.0', '122.0', '123.0'],
  'Samsung Internet': ['24.0', '25.0', '26.0'],
};

const OS_VERSIONS: Record<string, string[]> = {
  Windows: ['10', '11'],
  macOS: ['13.0', '14.0', '14.3', '14.5'],
  Linux: ['6.1', '6.5', '6.8'],
  iOS: ['17.0', '17.2', '17.4', '18.0'],
  Android: ['13', '14', '15'],
};

// Weighted device profiles based on real-world browser market share
// Chrome ~65%, Safari ~18%, Firefox ~3%, Edge ~5%, Samsung Internet ~2.5%, Opera ~2.5%
const DEVICE_PROFILES: [
  number,
  () => Omit<DeviceProfile, 'browser_version' | 'os_version'>
][] = [
  // Desktop Chrome on Windows (~35%)
  [
    35,
    () => ({
      device_type: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      platform: 'web',
    }),
  ],
  // Desktop Chrome on macOS (~10%)
  [
    10,
    () => ({
      device_type: 'desktop',
      browser: 'Chrome',
      os: 'macOS',
      platform: 'web',
    }),
  ],
  // Desktop Chrome on Linux (~3%)
  [
    3,
    () => ({
      device_type: 'desktop',
      browser: 'Chrome',
      os: 'Linux',
      platform: 'web',
    }),
  ],
  // Mobile Chrome on Android (~17%)
  [
    17,
    () => ({
      device_type: 'mobile',
      browser: 'Chrome',
      os: 'Android',
      platform: 'android',
    }),
  ],
  // Desktop Safari on macOS (~7%)
  [
    7,
    () => ({
      device_type: 'desktop',
      browser: 'Safari',
      os: 'macOS',
      platform: 'web',
    }),
  ],
  // Mobile Safari on iOS (~11%)
  [
    11,
    () => ({
      device_type: 'mobile',
      browser: 'Safari',
      os: 'iOS',
      platform: 'ios',
    }),
  ],
  // Tablet Safari on iOS (~2%)
  [
    2,
    () => ({
      device_type: 'tablet',
      browser: 'Safari',
      os: 'iOS',
      platform: 'ios',
    }),
  ],
  // Desktop Edge on Windows (~5%)
  [
    5,
    () => ({
      device_type: 'desktop',
      browser: 'Edge',
      os: 'Windows',
      platform: 'web',
    }),
  ],
  // Desktop Firefox on Windows (~1.5%)
  [
    1.5,
    () => ({
      device_type: 'desktop',
      browser: 'Firefox',
      os: 'Windows',
      platform: 'web',
    }),
  ],
  // Desktop Firefox on macOS (~0.5%)
  [
    0.5,
    () => ({
      device_type: 'desktop',
      browser: 'Firefox',
      os: 'macOS',
      platform: 'web',
    }),
  ],
  // Desktop Firefox on Linux (~1%)
  [
    1,
    () => ({
      device_type: 'desktop',
      browser: 'Firefox',
      os: 'Linux',
      platform: 'web',
    }),
  ],
  // Samsung Internet on Android (~2.5%)
  [
    2.5,
    () => ({
      device_type: 'mobile',
      browser: 'Samsung Internet',
      os: 'Android',
      platform: 'android',
    }),
  ],
  // Tablet Chrome on Android (~2%)
  [
    2,
    () => ({
      device_type: 'tablet',
      browser: 'Chrome',
      os: 'Android',
      platform: 'android',
    }),
  ],
];

function pickDeviceProfile(): DeviceProfile {
  const profile = weightedPick(DEVICE_PROFILES)();
  return {
    ...profile,
    browser_version: pick(BROWSER_VERSIONS[profile.browser]),
    os_version: pick(OS_VERSIONS[profile.os]),
  };
}

const COUNTRIES = [
  { code: 'USA', state: 'California', city: 'San Francisco' },
  { code: 'USA', state: 'California', city: 'Los Angeles' },
  { code: 'USA', state: 'New York', city: 'New York' },
  { code: 'USA', state: 'Texas', city: 'Austin' },
  { code: 'USA', state: 'Washington', city: 'Seattle' },
  { code: 'GBR', state: 'England', city: 'London' },
  { code: 'GBR', state: 'Scotland', city: 'Edinburgh' },
  { code: 'DEU', state: 'Bavaria', city: 'Munich' },
  { code: 'DEU', state: 'Berlin', city: 'Berlin' },
  { code: 'FRA', state: 'Île-de-France', city: 'Paris' },
  { code: 'BRA', state: 'São Paulo', city: 'São Paulo' },
  { code: 'BRA', state: 'Rio de Janeiro', city: 'Rio de Janeiro' },
  { code: 'BRA', state: 'Minas Gerais', city: 'Belo Horizonte' },
  { code: 'JPN', state: 'Tokyo', city: 'Tokyo' },
  { code: 'AUS', state: 'New South Wales', city: 'Sydney' },
  { code: 'CAN', state: 'Ontario', city: 'Toronto' },
  { code: 'IND', state: 'Karnataka', city: 'Bangalore' },
  { code: 'IND', state: 'Maharashtra', city: 'Mumbai' },
  { code: 'KOR', state: 'Seoul', city: 'Seoul' },
  { code: 'NLD', state: 'North Holland', city: 'Amsterdam' },
];

const REFERRERS = [
  'google',
  'google',
  'google', // weighted
  'twitter',
  'linkedin',
  'github',
  'direct',
  'direct',
  'hackernews',
  'reddit',
  'producthunt',
];

const UTM_SOURCES = ['google', 'twitter', 'linkedin', 'newsletter', 'github'];
const UTM_MEDIUMS = ['cpc', 'organic', 'social', 'email', 'referral'];
const UTM_CAMPAIGNS = [
  'spring-launch',
  'beta-invite',
  'docs-update',
  'black-friday',
  'webinar-q1',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(weighted: [number, T][]): T {
  const total = weighted.reduce((sum, [w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [weight, value] of weighted) {
    r -= weight;
    if (r <= 0) return value;
  }
  return weighted[weighted.length - 1][1];
}

function weightedTimestamp(startMs: number, endMs: number): number {
  // More events towards "now" — simulates growing traffic
  const r = Math.random();
  const biased = 1 - (1 - r) * (1 - r); // quadratic bias towards 1 (recent)
  return Math.floor(startMs + biased * (endMs - startMs));
}

// ── User / session simulation ───────────────────────────────────────────────

const NUM_USERS = Math.max(100, Math.floor(TOTAL / 30));
const users: string[] = Array.from(
  { length: NUM_USERS },
  () => `user_${randomUUID().slice(0, 12)}`
);
// Some events are anonymous
users.push('', '', '');

interface Session {
  sessionId: string;
  userId: string;
  startMs: number;
  device: DeviceProfile;
  country: (typeof COUNTRIES)[number];
  eventCount: number;
}

const endMs = Date.now();
const startMs = endMs - DAYS_BACK * 24 * 60 * 60 * 1000;

function createSession(timestampMs: number): Session {
  return {
    sessionId: uuidv7(timestampMs),
    userId: pick(users),
    startMs: timestampMs,
    device: pickDeviceProfile(),
    country: pick(COUNTRIES),
    eventCount: 0,
  };
}

// ── Event generation ────────────────────────────────────────────────────────

function generateEvent(session: Session): Record<string, unknown> {
  const eventName = pick(EVENT_NAMES);

  // Advance timestamp within session (1-30 seconds between events)
  const eventMs =
    session.startMs + session.eventCount * (1000 + Math.random() * 29_000);
  session.eventCount++;

  const event: Record<string, unknown> = {
    event_id: uuidv7(eventMs),
    session_id: session.sessionId,
    user_id: session.userId,
    event_name: eventName,
    timestamp: new Date(eventMs).toISOString(),
    country: session.country.code,
    state: session.country.state,
    city: session.country.city,
    device_type: session.device.device_type,
    platform: session.device.platform,
    browser: session.device.browser,
    browser_version: session.device.browser_version,
    os: session.device.os,
    os_version: session.device.os_version,
  };

  // Custom properties — vary by event type
  const propsStr: Record<string, string> = {};
  const propsNum: Record<string, number> = {};
  const propsBool: Record<string, boolean> = {};

  if (eventName === 'page_view') {
    propsStr['path'] = pick(PAGES);
    propsStr['referrer'] = pick(REFERRERS);
    if (Math.random() < 0.3) {
      propsStr['utm_source'] = pick(UTM_SOURCES);
      propsStr['utm_medium'] = pick(UTM_MEDIUMS);
      propsStr['utm_campaign'] = pick(UTM_CAMPAIGNS);
    }
  } else if (eventName === 'click') {
    propsStr['element'] = pick(['button', 'link', 'card', 'nav-item', 'cta']);
    propsStr['page'] = pick(PAGES);
  } else if (eventName === 'purchase') {
    propsNum['amount'] = Math.round(Math.random() * 500 * 100) / 100;
    propsStr['currency'] = pick(['USD', 'EUR', 'GBP', 'BRL']);
    propsStr['plan'] = pick(['starter', 'pro', 'enterprise']);
  } else if (eventName === 'search') {
    propsStr['query'] = pick([
      'analytics',
      'pricing',
      'api docs',
      'sdk',
      'integration',
      'dashboard',
      'events',
    ]);
    propsNum['results_count'] = Math.floor(Math.random() * 50);
  } else if (eventName === 'scroll_depth') {
    propsNum['depth_percent'] = pick([25, 50, 75, 100]);
    propsStr['page'] = pick(PAGES);
  } else if (eventName === 'video_play') {
    propsStr['video_id'] = pick(['intro', 'demo', 'tutorial-1', 'tutorial-2']);
    propsNum['duration_sec'] = Math.floor(Math.random() * 300);
    propsBool['autoplay'] = Math.random() < 0.3;
  } else if (eventName === 'form_submit') {
    propsStr['form_name'] = pick([
      'contact',
      'newsletter',
      'feedback',
      'demo-request',
    ]);
    propsBool['success'] = Math.random() < 0.9;
  } else if (eventName === 'add_to_cart') {
    propsStr['product'] = pick([
      'starter',
      'pro',
      'enterprise',
      'addon-seats',
      'addon-storage',
    ]);
    propsNum['quantity'] = Math.floor(Math.random() * 5) + 1;
  }

  if (Object.keys(propsStr).length > 0) event.props_str = propsStr;
  if (Object.keys(propsNum).length > 0) event.props_num = propsNum;
  if (Object.keys(propsBool).length > 0) event.props_bool = propsBool;

  return event;
}

// ── Batch generation ────────────────────────────────────────────────────────

function generateBatch(size: number): Record<string, unknown>[] {
  const batch: Record<string, unknown>[] = [];
  let session = createSession(weightedTimestamp(startMs, endMs));
  const eventsPerSession = 3 + Math.floor(Math.random() * 15); // 3-17 events per session

  for (let i = 0; i < size; i++) {
    if (session.eventCount >= eventsPerSession) {
      session = createSession(weightedTimestamp(startMs, endMs));
    }
    batch.push(generateEvent(session));
  }

  return batch;
}

// ── Latency histogram ───────────────────────────────────────────────────────

const BUCKETS = [1, 2, 5, 10, 15, 25, 50, 75, 100, 150, 250, 500, 1000, Infinity];
const histogram = new Uint32Array(BUCKETS.length);
let latencyMin = Infinity;
let latencyMax = 0;
let latencySum = 0;
let latencyCount = 0;

function recordLatency(ms: number) {
  latencyCount++;
  latencySum += ms;
  if (ms < latencyMin) latencyMin = ms;
  if (ms > latencyMax) latencyMax = ms;
  for (let i = 0; i < BUCKETS.length; i++) {
    if (ms <= BUCKETS[i]) {
      histogram[i]++;
      break;
    }
  }
}

function printHistogram() {
  console.log('\nLatency histogram:');
  let cumulative = 0;
  for (let i = 0; i < BUCKETS.length; i++) {
    if (histogram[i] === 0) continue;
    cumulative += histogram[i];
    const pct = ((cumulative / latencyCount) * 100).toFixed(1);
    const label =
      BUCKETS[i] === Infinity
        ? `> ${BUCKETS[i - 1]}ms`
        : `≤ ${String(BUCKETS[i]).padStart(5)}ms`;
    const bar = '█'.repeat(Math.ceil((histogram[i] / latencyCount) * 50));
    console.log(
      `  ${label}  ${String(histogram[i]).padStart(8)}  ${pct.padStart(5)}%  ${bar}`,
    );
  }
  console.log(
    `\n  min: ${latencyMin.toFixed(1)}ms  avg: ${(latencySum / latencyCount).toFixed(1)}ms  max: ${latencyMax.toFixed(1)}ms  samples: ${latencyCount.toLocaleString()}`,
  );
}

// ── HTTP sender with concurrency control ────────────────────────────────────

async function sendBatch(batch: Record<string, unknown>[]): Promise<void> {
  const start = performance.now();
  const res = await fetch(`${ENDPOINT}/ingest-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(batch),
  });
  recordLatency(performance.now() - start);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

async function run(): Promise<void> {
  const totalBatches = Math.ceil(TOTAL / BATCH_SIZE);

  console.log(`Seeding ${TOTAL.toLocaleString()} events`);
  console.log(`  Endpoint:    ${ENDPOINT}/ingest-bulk`);
  console.log(`  Batch size:  ${BATCH_SIZE}`);
  console.log(`  Batches:     ${totalBatches}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Time range:  last ${DAYS_BACK} days`);
  console.log(`  Users:       ~${NUM_USERS.toLocaleString()}`);
  console.log();

  let sent = 0;
  let failed = 0;
  const t0 = performance.now();
  let lastLog = 0;

  // Process batches with bounded concurrency
  let batchIndex = 0;
  const inFlight = new Set<Promise<void>>();

  while (batchIndex < totalBatches) {
    while (inFlight.size < CONCURRENCY && batchIndex < totalBatches) {
      const remaining = TOTAL - batchIndex * BATCH_SIZE;
      const size = Math.min(BATCH_SIZE, remaining);
      const batch = generateBatch(size);
      const idx = batchIndex;

      const p = sendBatch(batch)
        .then(() => {
          sent += size;
          const now = performance.now();
          if (now - lastLog > 1000) {
            lastLog = now;
            const elapsed = ((now - t0) / 1000).toFixed(1);
            const rate = Math.floor(sent / ((now - t0) / 1000));
            process.stdout.write(
              `\r  Sent ${sent.toLocaleString()} / ${TOTAL.toLocaleString()} events (${elapsed}s, ~${rate.toLocaleString()} events/s)`
            );
          }
        })
        .catch((err) => {
          failed++;
          console.error(`\n  Batch ${idx} failed: ${err.message}`);
        })
        .finally(() => {
          inFlight.delete(p);
        });

      inFlight.add(p);
      batchIndex++;
    }

    // Wait for at least one to finish before sending more
    if (inFlight.size >= CONCURRENCY) {
      await Promise.race(inFlight);
    }
  }

  // Wait for remaining
  await Promise.all(inFlight);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  const rate = Math.floor(sent / ((performance.now() - t0) / 1000));
  console.log(
    `\n\nDone in ${elapsed}s — ${sent.toLocaleString()} events sent (~${rate.toLocaleString()} events/s)`
  );
  if (failed > 0) console.log(`  ${failed} batches failed`);
  printHistogram();
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
