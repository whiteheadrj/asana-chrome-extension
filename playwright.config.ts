import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright configuration for Chrome extension E2E testing.
 *
 * Chrome extensions require:
 * - Non-headless mode (extensions don't load in headless)
 * - Path to the built extension in dist/
 * - Chromium-based browser only
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Extensions need single browser context
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Extensions work best with single worker
  reporter: 'html',
  timeout: 60000, // 60s timeout for extension tests

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome extension testing requires specific launch options
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'dist')}`,
            `--load-extension=${path.resolve(__dirname, 'dist')}`,
            '--no-sandbox',
          ],
          // Extensions don't work in headless mode
          headless: false,
        },
      },
    },
  ],

  // Run build before E2E tests to ensure latest extension code
  webServer: {
    command: 'pnpm build',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
