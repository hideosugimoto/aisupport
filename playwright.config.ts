import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run Next.js dev server before tests */
  webServer: {
    command: 'E2E_MOCK=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_MOCK: 'true',
      NODE_ENV: process.env.NODE_ENV || 'test',
    },
  },
});
