import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'clickhouse',
    environment: 'node',
    globals: true,
    watch: false,
    include: ['src/**/*.spec.ts'],
    coverage: { reportsDirectory: 'test-output/vitest/coverage', provider: 'v8' },
  },
});
