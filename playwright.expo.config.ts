import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the website built from the Expo app (stage 1 of
// DECISIONS.md W1): `npm run test:e2e:expo`.
//
// Same rules as playwright.config.ts: built against a fake Supabase URL and
// answered in the browser by e2e/support/backend.ts, so it runs offline and
// never touches production. The export goes to dist-e2e-expo/, runs the same
// post-build step as the Vercel preview, and is served like vercel.json
// serves it (scripts/expo-web/serve.cjs).

const PORT = 4174;

// The export below uses --clear so the fake backend address cannot come from
// a cached build. Metro's cache lives in the temp folder, so with the shared
// one that also wiped the cache the phone dev server relies on: the next
// phone start rebuilt everything (7 minutes) and timed out. Its own folder
// keeps a test run from touching the phone's cache.
const E2E_TEMP = `${process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'}/shtepia-e2e-expo-temp`;

export default defineConfig({
  testDir: './e2e-expo',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [[process.env.CI ? 'line' : 'list'], ['html', { open: 'never', outputFolder: 'playwright-report-expo' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // The headline animates otherwise, and tests read it. X85 turns it back on.
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  // The phone layout at 390x844 is the design (the website is a phone-width
  // column); desktop checks the same column on a wide screen.
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command:
      `node -e "require('fs').mkdirSync(require('os').tmpdir(),{recursive:true})" && ` +
      `npx expo export -p web --clear --output-dir dist-e2e-expo && ` +
      `node scripts/expo-web-postbuild.mjs dist-e2e-expo && ` +
      `node scripts/expo-web/serve.cjs dist-e2e-expo ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: {
      CI: '1',
      TEMP: E2E_TEMP,
      TMP: E2E_TEMP,
      TMPDIR: E2E_TEMP,
      EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
      EXPO_PUBLIC_SITE_URL: '',
    },
  },
});
