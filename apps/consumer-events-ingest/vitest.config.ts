import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'consumer-events-ingest',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
