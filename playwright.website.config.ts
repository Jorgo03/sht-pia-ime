import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the website in website/ (DECISIONS.md W10):
// `npm run test:e2e:website`. Same rules as playwright.config.ts: built
// against a fake Supabase URL and answered in the browser by
// e2e/support/backend.ts, so it runs offline, signs in as the fixtures'
// agent without any real account, and never touches production.

const PORT = 4175;

export default defineConfig({
  testDir: './e2e-website',
  // Its own folder: another suite running at the same time empties test-results/.
  outputDir: 'test-results-website',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [[process.env.CI ? 'line' : 'list'], ...(process.env.CI ? [['github'] as ['github']] : []), ['html', { open: 'never', outputFolder: 'playwright-report-website' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/build-website.mjs dist-e2e-website && node scripts/website/serve.cjs dist-e2e-website ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      SITE_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: '',
    },
  },
});
