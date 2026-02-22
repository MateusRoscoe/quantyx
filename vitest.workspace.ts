import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api-event-webhook/vitest.config.ts',
  'apps/api-tenant-manager/vitest.config.ts',
  'apps/consumer-events-ingest/vitest.config.ts',
  'libs/shared/vitest.config.ts',
  'libs/auth/vitest.config.ts',
  'libs/clickhouse/vitest.config.ts',
]);
