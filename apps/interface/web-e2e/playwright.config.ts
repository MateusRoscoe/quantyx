import { dirname, resolve } from 'path';
import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = 'http://localhost:3000';
const apiURL = 'http://localhost:3001';
const workspaceRoot = resolve(dirname(__filename), '../../..');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx nx dev web',
      url: baseURL,
      cwd: workspaceRoot,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: apiURL },
    },
    {
      command: 'npx nx serve api-tenant-manager',
      url: `${apiURL}/healthz`,
      cwd: workspaceRoot,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
