import { defineConfig } from 'vitest/config';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'resolve-ts-from-js',
      enforce: 'pre',
      resolveId(id, importer) {
        if (!importer || !id.startsWith('.') || !id.endsWith('.js')) return null;
        const tsPath = resolve(dirname(importer), id.replace(/\.js$/, '.ts'));
        if (existsSync(tsPath)) return tsPath;
        return null;
      },
    },
  ],
  test: {
    name: 'consumer-events-ingest',
    environment: 'node',
    globals: true,
    watch: false,
    include: ['src/**/*.spec.ts'],
    globalSetup: ['./vitest.globalSetup.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    coverage: { reportsDirectory: 'test-output/vitest/coverage', provider: 'v8' },
    server: {
      deps: {
        inline: true,
      },
    },
  },
});
