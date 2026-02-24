import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = 'http://localhost:3000';
const apiURL = 'http://localhost:3001';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  webServer: [
    {
      command: 'npx nx dev web',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: apiURL },
    },
    {
      command: 'npx nx serve api-tenant-manager',
      url: `${apiURL}/healthz`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
