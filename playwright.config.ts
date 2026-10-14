import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the web app: `npm run test:e2e`.
//
// The site is built against a fake Supabase URL (e2e.supabase.co) and every
// backend call is answered inside the browser by e2e/support/backend.ts, so the
// suite runs offline and can never touch the production database. The build
// goes to dist-e2e/ so it never overwrites a real `npm run build`.
//
// First run on a machine: `npm run test:e2e:install` downloads Chromium.
// PW_CHROMIUM_PATH points at an existing Chromium instead (e.g. a sandbox
// with a preinstalled browser).

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_LEGAL_CONTACT_EMAIL: '',
    },
  },
});
