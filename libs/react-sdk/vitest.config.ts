import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'react-sdk',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: { reportsDirectory: 'test-output/vitest/coverage', provider: 'v8' },
  },
});
